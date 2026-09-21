import { prisma } from "../db";
import { generateText, nextPreferredSlots } from "../campaign";
import { generateRecommendations, respondToRecommendation } from "./recommendations";
import { checkAccess, checkPostQuota } from "../gating";

// Publication autonome depuis le copilote éditorial — STRICTEMENT opt-in
// (User.autoPublishThreshold non nul). Par défaut (null), un compte n'est
// jamais concerné : aucun changement de comportement pour les utilisateurs
// existants ni pour les clients gérés par une agence qui n'ont pas activé
// l'option eux-mêmes.
//
// Quand activé : la recommandation la mieux notée dont la confiance atteint
// le seuil choisi est programmée directement (statut "programmé", sans
// passer par "à valider") sur le prochain créneau libre du rythme de
// publication habituel — pas de publication instantanée hors créneau.
// La génération du texte réutilise lib/campaign.js (même moteur que le
// pilote automatique existant) ; la publication effective au moment prévu
// reste gérée par lib/scheduler.js::runDuePublications, sans changement.

const THROTTLE_MS = 60 * 60 * 1000;
let lastRun = 0;

// Transparence : quand l'autopilot a tourné pour la dernière fois et à
// partir de quand il pourra retourner vérifier les recommandations.
export function getAutopilotStatus() {
  return {
    lastRunAt: lastRun ? new Date(lastRun) : null,
    nextEligibleAt: lastRun ? new Date(lastRun + THROTTLE_MS) : null,
  };
}

export async function runEditorialAutopilot() {
  if (Date.now() - lastRun < THROTTLE_MS) return { skipped: true };
  lastRun = Date.now();

  const candidates = await prisma.user.findMany({
    where: { autoPublishThreshold: { not: null }, expertise: { not: null }, publishDays: { not: null } },
  });

  let published = 0;
  for (const user of candidates) {
    try {
      const access = await checkAccess(user.id);
      if (!access.ok) continue;
      const quota = await checkPostQuota(user.id);
      if (!quota.ok) continue;

      const recos = await generateRecommendations(user.id, { count: 3 });
      const best = recos
        .filter((r) => r.status === "proposée" && r.confidence >= user.autoPublishThreshold)
        .sort((a, b) => b.priority - a.priority)[0];
      if (!best) continue; // rien n'atteint le seuil de confiance choisi

      // Prochain créneau libre (ne percute pas un post déjà programmé/à valider)
      const now = new Date();
      const horizon = new Date(now.getTime() + 14 * 86400000);
      const slots = nextPreferredSlots(user, 20, now);
      const occupied = new Set(
        (
          await prisma.draft.findMany({
            where: { userId: user.id, status: { in: ["programmé", "à valider"] }, scheduledAt: { gte: now, lte: horizon } },
            select: { scheduledAt: true },
          })
        ).map((d) => d.scheduledAt.getTime())
      );
      const slot = slots.find((s) => !occupied.has(s.getTime()));
      if (!slot) continue;

      const theme = `${best.topic} — ${best.angle}`;
      const context = [
        best.hook && `Accroche suggérée : ${best.hook}`,
        best.cta && `Appel à l'action suggéré : ${best.cta}`,
        `Justification retenue par le copilote : ${best.rationale}`,
      ]
        .filter(Boolean)
        .join("\n");

      const { text, inspirationUrl } = await generateText(user, theme, context, null);

      const draft = await prisma.draft.create({
        data: {
          userId: user.id,
          type: best.postType,
          theme: best.topic.slice(0, 200),
          expertise: user.expertise,
          tone: user.tone || "Professionnel",
          maxChars: user.defaultMaxChars || 1300,
          text,
          generatedText: text,
          status: "programmé",
          scheduledAt: slot,
          target: "person",
          auto: true,
          pillarId: best.pillarId,
          inspirationUrl,
        },
      });

      await respondToRecommendation(user.id, best.id, { status: "planifiée", draftId: draft.id });
      published++;
      console.log(
        `[autopilot-editorial] post programmé pour ${user.id} le ${slot.toISOString()} (confiance ${best.confidence} ≥ seuil ${user.autoPublishThreshold})`
      );
    } catch (e) {
      console.error(`[autopilot-editorial] utilisateur ${user.id}:`, e.message);
    }
  }
  return { users: candidates.length, published };
}
