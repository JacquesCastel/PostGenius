import { prisma } from "./db";
import { analyze, MIN_MEASURED } from "./coach";
import { bestMeasure, summarize, explain, WINDOWS } from "./measures";
import { deriveInsights } from "./performanceInsights";
import { qualifyObjective } from "./qualification";

// Le coach d'après les mesures déjà enregistrées (aucun appel à LinkedIn, aucune IA).
// scope : "profile" (posts du profil) ou "page" (posts de cette page, org = urn). "all" est conservé pour les créneaux conseillés du planning :
// il analyse le PROFIL seul — un profil et une page n'ont pas la même audience, ils ne sont jamais comparés dans un même calcul.
// Chaque analyse n'utilise qu'UNE maturité de mesure (J+7 si assez de posts y sont mesurés, sinon J+1) et retient, pour chaque post, la mesure
// dont l'âge réel est le plus proche de 168 h (ou 24 h). Les posts écartés et la raison sont renvoyés (`excluded`, `notes`). Voir lib/measures.js.
export async function coachFor(userId, { scope = "all", org = null, performanceInsights = false } = {}) {
  const target = scope === "page" ? { target: org } : { target: "person" };
  const [drafts, contexts, user] = await Promise.all([
    prisma.draft.findMany({
      where: { userId, status: "publié", publishedAt: { not: null }, ...target },
      orderBy: { publishedAt: "desc" },
      take: 300,
      select: { id: true, publishedAt: true, target: true, text: true, type: true, imageUrl: true, videoUrl: true, youtubeUrl: true, mood: true, contextId: true, ...(performanceInsights ? { campaignPost: { select: { objective: true } }, campaign: { select: { objective: true } }, editorialReco: { select: { objective: true } } } : {}), performance: { select: { offsetHours: true, capturedAt: true, impressions: true, likes: true, comments: true, shares: true } } },
    }),
    prisma.context.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { companyName: true, publishDays: true, publishTime: true } }),
  ]);
  const posts = drafts.map((d) => ({ id: d.id, publishedAt: d.publishedAt, measures: d.performance }));
  const summary = summarize(posts, Date.now(), MIN_MEASURED);
  const rows = [];
  for (const d of drafts) {
    const m = bestMeasure(d.performance, d.publishedAt, summary.maturity);
    if (!m) continue;
    const { performance, campaignPost, campaign, editorialReco, ...rest } = d;
    rows.push({ ...rest, impressions: m.impressions, likes: m.likes, comments: m.comments, shares: m.shares, ...(performanceInsights ? { objective: qualifyObjective({ campaignPost, campaign, editorialReco })?.value ?? null } : {}) });
  }
  const result = analyze(rows, { themeNames: new Map(contexts.map((c) => [c.id, c.name])), mainThemeName: user?.companyName || "Mon activité" });
  const current = { days: (user?.publishDays ?? "").split(",").map(Number).filter(Boolean), time: user?.publishTime ?? null };
  // Constats de performance (version d'essai, comptes autorisés seulement) : en plus du coach, jamais à sa place ni sur ses calculs
  const constats = performanceInsights ? deriveInsights(rows, { themeNames: new Map(contexts.map((c) => [c.id, c.name])), mainThemeName: user?.companyName || "Mon activité", maturity: WINDOWS[summary.maturity].label }) : null;
  return {
    scope, destination: scope === "page" ? org : "person", minMeasured: MIN_MEASURED, ...result, current,
    maturity: WINDOWS[summary.maturity].label, // "J+7" ou "J+1" : l'ancienneté commune des mesures comparées
    maturityFallback: summary.fallback,
    available: summary.available, // posts mesurables à chaque maturité : { j1, j7 }
    excluded: summary.excluded, // posts écartés, par raison : pending, missing, outOfWindow, noMeasure
    notes: explain(summary, { insightsCount: result.insights.length, min: MIN_MEASURED }),
    ...(constats ? { performanceInsights: { maturity: WINDOWS[summary.maturity].label, ...constats } } : {}),
  };
}
