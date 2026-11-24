import { prisma } from "../db";
import { generateText } from "../campaign";
import { generateRecommendations } from "./recommendations";
import { checkAccess, checkPostQuota } from "../gating";
import { nextFreeAutopilotSlot, findUnlinkedAutopilotDraft, scheduleAutopilotDraft } from "./autopilotStore";

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

  // Un client d'agence ne publie jamais de façon autonome : l'agence valide ses posts. On remet aussi à zéro un réglage
  // qui aurait été activé dans son espace (le curseur « Publication autonome » du copilote).
  const reset = await prisma.user.updateMany({ where: { agencyId: { not: null }, autoPublishThreshold: { not: null } }, data: { autoPublishThreshold: null } });
  if (reset.count) console.log(`[autopilot-editorial] publication autonome retirée de ${reset.count} compte(s) client d'agence`);

  const candidates = await prisma.user.findMany({
    where: { disabled: false, agencyId: null, autoPublishThreshold: { not: null }, expertise: { not: null }, publishDays: { not: null } },
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
        .filter((r) => r.status === "proposée" && !r.draftId && r.confidence >= user.autoPublishThreshold)
        .sort((a, b) => b.priority - a.priority)[0];
      if (!best) continue; // rien n'atteint le seuil de confiance choisi

      if (await findUnlinkedAutopilotDraft(prisma, user.id, best.topic)) {
        console.warn("[autopilot-editorial] sujet bloqué : un brouillon automatique sans recommandation existe déjà ; vérification manuelle requise.");
        continue;
      }
      // Éviter un appel IA si tous les créneaux sont déjà occupés. Le choix
      // définitif sera relu dans la transaction après la génération.
      if (!(await nextFreeAutopilotSlot(prisma, user))) continue;

      const theme = `${best.topic} — ${best.angle}`;
      const context = [
        best.hook && `Accroche suggérée : ${best.hook}`,
        best.cta && `Appel à l'action suggéré : ${best.cta}`,
        `Justification retenue par le copilote : ${best.rationale}`,
      ]
        .filter(Boolean)
        .join("\n");

      const { text, inspirationUrl } = await generateText(user, theme, context, null);

      const draft = await scheduleAutopilotDraft(user.id, best, { text, inspirationUrl });
      if (!draft) continue;
      published++;
      console.log(
        `[autopilot-editorial] post programmé pour ${user.id} le ${draft.scheduledAt.toISOString()} (confiance ${best.confidence} ≥ seuil ${user.autoPublishThreshold})`
      );
    } catch (e) {
      console.error(`[autopilot-editorial] utilisateur ${user.id}:`, e.message);
    }
  }
  return { users: candidates.length, published };
}
