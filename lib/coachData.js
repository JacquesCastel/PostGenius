import { prisma } from "./db";
import { analyze, MIN_MEASURED } from "./coach";

// Le coach d'après les mesures déjà enregistrées (aucun appel à LinkedIn, aucune IA).
// scope : "profile" (posts du profil), "page" (posts de cette page, org = urn) ou "all". Partagé par l'écran et par le MCP.
export async function coachFor(userId, { scope = "all", org = null } = {}) {
  const target = scope === "profile" ? { target: "person" } : scope === "page" ? { target: org } : {};
  const [drafts, contexts, user] = await Promise.all([
    prisma.draft.findMany({
      where: { userId, status: "publié", performance: { some: {} }, ...target },
      orderBy: { publishedAt: "desc" },
      take: 300,
      select: { id: true, publishedAt: true, target: true, text: true, type: true, imageUrl: true, videoUrl: true, youtubeUrl: true, mood: true, contextId: true, performance: { select: { offsetHours: true, impressions: true, likes: true, comments: true, shares: true } } },
    }),
    prisma.context.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { companyName: true, publishDays: true, publishTime: true } }),
  ]);
  const rows = drafts.map((d) => {
    const latest = [...d.performance].sort((a, b) => b.offsetHours - a.offsetHours)[0];
    const { performance, ...rest } = d;
    return { ...rest, impressions: latest?.impressions, likes: latest?.likes, comments: latest?.comments, shares: latest?.shares };
  });
  const result = analyze(rows, { themeNames: new Map(contexts.map((c) => [c.id, c.name])), mainThemeName: user?.companyName || "Mon activité" });
  const current = { days: (user?.publishDays ?? "").split(",").map(Number).filter(Boolean), time: user?.publishTime ?? null };
  return { scope, minMeasured: MIN_MEASURED, ...result, current };
}
