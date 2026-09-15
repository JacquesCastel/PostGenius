import { prisma } from "../db";

// Apprentissage à partir du feedback réel (accepté vs ignoré/rejeté) — PAS
// un modèle d'engagement entraîné sur les stats LinkedIn : avec le volume de
// données actuel (quelques posts, stats perso pas encore approuvées côté
// LinkedIn), un tel modèle apprendrait du bruit, pas un signal réel. Ce qui
// EST fiable dès aujourd'hui : ce que l'utilisateur accepte ou ignore.
// Lissage bayésien simple (Laplace) — pas de ML "lourd", mais un vrai
// ajustement qui évolue avec l'usage, pas un prompt statique.

const ACCEPTED = ["générée", "planifiée"];
const REJECTED = ["ignorée", "rejetée"];

function laplaceWeight(accepted, rejected) {
  // 1.0 = neutre (aucun historique). >1 = préféré, <1 = évité.
  // +1/+2 : lissage pour ne pas sur-réagir sur 1-2 exemples.
  return (2 * (accepted + 1)) / (accepted + rejected + 2);
}

// Renvoie { [pillarId]: poids, [postType]: poids } à partir de l'historique
// de feedback de l'utilisateur sur ses recommandations passées.
export async function getPreferenceWeights(userId) {
  const history = await prisma.editorialRecommendation.findMany({
    where: { userId, status: { in: [...ACCEPTED, ...REJECTED] } },
    select: { status: true, pillarId: true, postType: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const byPillar = {};
  const byType = {};
  for (const r of history) {
    const bucket = ACCEPTED.includes(r.status) ? "accepted" : "rejected";
    if (r.pillarId) {
      byPillar[r.pillarId] ??= { accepted: 0, rejected: 0 };
      byPillar[r.pillarId][bucket]++;
    }
    byType[r.postType] ??= { accepted: 0, rejected: 0 };
    byType[r.postType][bucket]++;
  }

  const pillarWeight = Object.fromEntries(
    Object.entries(byPillar).map(([id, c]) => [id, laplaceWeight(c.accepted, c.rejected)])
  );
  const postTypeWeight = Object.fromEntries(
    Object.entries(byType).map(([type, c]) => [type, laplaceWeight(c.accepted, c.rejected)])
  );

  return { pillarWeight, postTypeWeight, sampleSize: history.length };
}

// Applique les poids appris à une priorité brute (0-100), bornée.
export function applyPreference(priority, { pillarId, postType }, weights) {
  const pw = pillarId ? weights.pillarWeight[pillarId] ?? 1 : 1;
  const tw = weights.postTypeWeight[postType] ?? 1;
  return Math.min(100, Math.max(0, Math.round(priority * pw * tw)));
}
