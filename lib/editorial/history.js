import { prisma } from "../db";

// Historique éditorial d'un utilisateur + scores de saturation simples
// (heuristiques, pas de ML) utilisés pour éviter les recommandations
// répétitives — cf. section "anti-répétition" du copilote.

const HISTORY_SIZE = 15;

// Similarité grossière entre deux textes courts (Jaccard sur les mots ≥ 4
// lettres, en minuscule) — suffisant pour repérer "même thème reformulé".
function wordSet(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[a-z0-9]{4,}/g) || []
  );
}

export function similarity(a, b) {
  const sa = wordSet(a);
  const sb = wordSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter); // Jaccard
}

// Charge les N derniers posts (tous statuts confondus hors brouillon vide)
// avec leur pilier, pour nourrir le moteur de recommandations.
export async function getEditorialHistory(userId, { take = HISTORY_SIZE } = {}) {
  const drafts = await prisma.draft.findMany({
    where: { userId, status: { not: "erreur" } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      theme: true,
      text: true,
      status: true,
      type: true,
      createdAt: true,
      publishedAt: true,
      scheduledAt: true,
      pillarId: true,
      pillar: { select: { name: true } },
    },
  });

  const lastActivityAt = drafts[0]?.publishedAt ?? drafts[0]?.createdAt ?? null;
  const daysSinceLastPost = lastActivityAt
    ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86400000)
    : null;

  // Répartition par pilier sur l'historique chargé (posts non classés ignorés)
  const pillarCounts = {};
  for (const d of drafts) {
    if (!d.pillarId) continue;
    pillarCounts[d.pillarId] = (pillarCounts[d.pillarId] ?? 0) + 1;
  }
  const classified = drafts.filter((d) => d.pillarId).length;

  return { drafts, lastActivityAt, daysSinceLastPost, pillarCounts, classified };
}

// Score de saturation d'un pilier (0-1) : part de l'historique récent qui lui
// appartient déjà. Élevé = pilier sur-utilisé, à éviter pour la prochaine reco.
export function pillarSaturationScore(pillarId, { pillarCounts, classified }) {
  if (!pillarId || !classified) return 0;
  return (pillarCounts[pillarId] ?? 0) / classified;
}

// Score de similarité d'un sujet candidat avec les thèmes récents (0-1).
// Élevé = ce sujet (ou une reformulation) a déjà été traité récemment.
export function topicSimilarityScore(candidateTopic, history) {
  if (!candidateTopic || !history.length) return 0;
  let max = 0;
  for (const d of history) {
    const s = Math.max(similarity(candidateTopic, d.theme), similarity(candidateTopic, d.text?.slice(0, 300)));
    if (s > max) max = s;
  }
  return max;
}

// Résumé textuel de l'historique récent, prêt à être injecté dans un prompt.
export function historyDigest(history, pillars) {
  const pillarById = Object.fromEntries(pillars.map((p) => [p.id, p.name]));
  const lines = history.drafts.slice(0, 10).map((d) => {
    const pillarName = d.pillarId ? pillarById[d.pillarId] ?? d.pillar?.name : "non classé";
    const when = d.publishedAt ?? d.createdAt;
    return `- [${d.status}] "${d.theme}" (pilier : ${pillarName}, ${new Date(when).toLocaleDateString("fr-FR")})`;
  });

  const balance = pillars
    .map((p) => ({ name: p.name, count: history.pillarCounts[p.id] ?? 0 }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((p) => `${p.name} (${p.count})`)
    .join(", ");

  return {
    recentPostsBlock: lines.length ? lines.join("\n") : "(aucun post récent)",
    pillarBalanceBlock: balance || "(aucun post classé par pilier pour l'instant)",
    daysSinceLastPost: history.daysSinceLastPost,
  };
}
