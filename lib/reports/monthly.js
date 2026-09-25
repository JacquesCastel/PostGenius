import { prisma } from "../db";

// Rapport mensuel de performance d'un client (page entreprise) — agrège des données déjà
// collectées (Draft, PostPerformance, EditorialRecommendation) pour un mois donné.
// Ne calcule ni ne prédit rien de nouveau : un instantané lisible, pensé pour être montré
// tel quel à un client d'agence.

export async function getMonthlyReport(userId, { year, month }) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const posts = await prisma.draft.findMany({
    where: { userId, status: "publié", publishedAt: { gte: start, lt: end } },
    orderBy: { publishedAt: "asc" },
    include: { performance: true },
  });

  // Instantané le plus complet disponible pour chaque post (J+7 si capturé, sinon J+1).
  const withRate = posts.map((p) => {
    const perf =
      p.performance.find((x) => x.offsetHours === 168) ??
      [...p.performance].sort((a, b) => b.offsetHours - a.offsetHours)[0] ??
      null;
    const engagements = perf ? (perf.likes ?? 0) + (perf.comments ?? 0) + (perf.shares ?? 0) : null;
    const engagementRate = perf?.impressions ? engagements / perf.impressions : null;
    return {
      id: p.id,
      theme: p.theme,
      excerpt: p.text.slice(0, 140),
      publishedAt: p.publishedAt,
      impressions: perf?.impressions ?? null,
      engagements,
      engagementRate,
    };
  });

  const withStats = withRate.filter((p) => p.impressions != null);
  const totalImpressions = withStats.reduce((s, p) => s + p.impressions, 0);
  const totalEngagements = withStats.reduce((s, p) => s + (p.engagements ?? 0), 0);
  const avgEngagementRate = totalImpressions ? totalEngagements / totalImpressions : null;

  const topPosts = [...withStats].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0)).slice(0, 3);

  const recoCounts = await prisma.editorialRecommendation.groupBy({
    by: ["status"],
    where: { userId, createdAt: { gte: start, lt: end } },
    _count: true,
  });
  const recommendations = Object.fromEntries(recoCounts.map((r) => [r.status, r._count]));
  const proposed = Object.values(recommendations).reduce((s, n) => s + n, 0);
  const followed = (recommendations["générée"] ?? 0) + (recommendations["planifiée"] ?? 0);

  return {
    period: { year, month },
    postsPublished: posts.length,
    postsWithStats: withStats.length,
    totalImpressions,
    totalEngagements,
    avgEngagementRate,
    topPosts,
    posts: withRate,
    recommendations: { proposed, followed },
  };
}
