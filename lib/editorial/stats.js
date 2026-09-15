import { prisma } from "../db";
import { getPreferenceWeights } from "./learning";

// Indicateurs de transparence pour le copilote éditorial — expose ce que
// l'algorithme a fait et appris, pour que le pilotage ne repose plus
// uniquement sur le profil (réglages "à l'aveugle").

const ACCEPTED = ["générée", "planifiée"];
const REJECTED = ["ignorée", "rejetée"];

export async function getEditorialStats(userId) {
  const [recos, pillars, preference] = await Promise.all([
    prisma.editorialRecommendation.findMany({
      where: { userId },
      include: { pillar: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.editorialPillar.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    getPreferenceWeights(userId),
  ]);

  const total = recos.length;
  const accepted = recos.filter((r) => ACCEPTED.includes(r.status)).length;
  const rejected = recos.filter((r) => REJECTED.includes(r.status)).length;
  const pending = recos.filter((r) => r.status === "proposée").length;
  const acceptanceRate = accepted + rejected > 0 ? accepted / (accepted + rejected) : null;
  const avgConfidence = total ? Math.round(recos.reduce((s, r) => s + r.confidence, 0) / total) : null;

  // Détail par pilier : combine le nombre de recos passées et le poids appris
  const byPillar = pillars.map((p) => {
    const forPillar = recos.filter((r) => r.pillarId === p.id);
    const acc = forPillar.filter((r) => ACCEPTED.includes(r.status)).length;
    const rej = forPillar.filter((r) => REJECTED.includes(r.status)).length;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isDefault: p.isDefault,
      proposed: forPillar.length,
      accepted: acc,
      rejected: rej,
      weight: preference.pillarWeight[p.id] ?? 1,
    };
  });

  const byPostType = ["simple", "carrousel", "video"].map((type) => {
    const forType = recos.filter((r) => r.postType === type);
    return {
      type,
      proposed: forType.length,
      weight: preference.postTypeWeight[type] ?? 1,
    };
  });

  const recent = recos.slice(0, 15).map((r) => ({
    id: r.id,
    topic: r.topic,
    rationale: r.rationale,
    pillar: r.pillar?.name ?? null,
    postType: r.postType,
    priority: r.priority,
    confidence: r.confidence,
    status: r.status,
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
  }));

  return {
    totals: { total, accepted, rejected, pending, acceptanceRate, avgConfidence, learnedFrom: preference.sampleSize },
    byPillar,
    byPostType,
    recent,
  };
}
