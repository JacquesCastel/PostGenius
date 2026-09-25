import { prisma } from "../db";
import { decryptToken } from "../crypto";
import { fetchOrgShareStats } from "../linkedin/orgShareStats";

// Historique de performance réelle des posts publiés sur les pages entreprise — le
// chaînon qui manquait pour un jour relier les recommandations à de vrais résultats
// LinkedIn plutôt qu'au seul accepté/ignoré (voir lib/editorial/learning.js). Ne
// calcule ni ne prédit rien ici : capture seulement des instantanés dans le temps.
// Profils personnels exclus : la permission LinkedIn nécessaire
// (r_member_postAnalytics) est encore en attente de revue.

const OFFSETS_HOURS = [24, 168]; // J+1 et J+7
const MAX_DRAFTS_PER_RUN = 30; // borne le travail par exécution (quota API LinkedIn)
const THROTTLE_MS = 3 * 60 * 60 * 1000; // au plus une fois toutes les 3 h

let lastRun = 0;

export async function capturePerformanceSnapshots() {
  if (Date.now() - lastRun < THROTTLE_MS) return { skipped: true };
  lastRun = Date.now();

  const now = Date.now();
  const earliestOffsetMs = OFFSETS_HOURS[0] * 3600_000;

  // Posts publiés sur une page entreprise, assez anciens pour au moins un palier dû.
  // Bornée à 200 candidats : filtrée plus finement ci-dessous, palier par palier.
  const candidates = await prisma.draft.findMany({
    where: {
      status: "publié",
      postId: { not: null },
      publishedAt: { lte: new Date(now - earliestOffsetMs) },
      target: { startsWith: "urn:li:organization:" },
    },
    orderBy: { publishedAt: "asc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      target: true,
      postId: true,
      publishedAt: true,
      performance: { select: { offsetHours: true } },
    },
  });

  const due = [];
  for (const d of candidates) {
    const captured = new Set(d.performance.map((p) => p.offsetHours));
    for (const offset of OFFSETS_HOURS) {
      if (captured.has(offset)) continue;
      if (now - new Date(d.publishedAt).getTime() >= offset * 3600_000) {
        due.push({ ...d, offset });
        break; // un palier par exécution pour ce post ; le suivant viendra à la prochaine
      }
    }
    if (due.length >= MAX_DRAFTS_PER_RUN) break;
  }
  if (!due.length) return { captured: 0 };

  // Regroupe par (compte, page) pour réutiliser le token et batcher l'appel LinkedIn.
  const groups = new Map();
  for (const d of due) {
    const key = `${d.userId}:${d.target}`;
    if (!groups.has(key)) groups.set(key, { userId: d.userId, org: d.target, drafts: [] });
    groups.get(key).drafts.push(d);
  }

  let captured = 0;
  for (const { userId, org, drafts } of groups.values()) {
    const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
    const orgToken = decryptToken(acc?.orgToken);
    if (!orgToken) continue; // page déconnectée depuis : on réessaiera au palier suivant

    let statsByUrn;
    try {
      statsByUrn = await fetchOrgShareStats(orgToken, org, drafts.map((d) => d.postId));
    } catch (e) {
      console.error("[performance] fetchOrgShareStats:", e.message);
      continue;
    }

    for (const d of drafts) {
      const s = statsByUrn[d.postId];
      if (!s) continue; // LinkedIn n'a rien renvoyé pour ce post : on retentera au palier suivant
      try {
        await prisma.postPerformance.create({
          data: {
            draftId: d.id,
            offsetHours: d.offset,
            impressions: s.impressionCount ?? null,
            likes: s.likeCount ?? null,
            comments: s.commentCount ?? null,
            shares: s.shareCount ?? null,
            clicks: s.clickCount ?? null,
          },
        });
        captured++;
      } catch (e) {
        // Contrainte unique (draftId, offsetHours) : déjà capturé par une exécution
        // concurrente, rien à faire.
        if (e.code !== "P2002") console.error("[performance] création:", e.message);
      }
    }
  }
  return { captured };
}
