import { prisma } from "./db";
import { pickSources } from "./knowledgeText";
import { chooseExamples } from "./styleCorpus";
import { parseExamples, MAX_POSTS } from "./postImport";
import { getRemarks } from "./remarks";

// Contexte que le copilote utilisera pour un post : ce que la génération injecte réellement
// (profil, sources de la base de connaissances, remarques, posts proches), avec les mêmes sélections
// que /api/generate, pour que l'auteur voie sur quoi le post va s'appuyer avant de lancer.

const PROFILE_FIELDS = [
  ["headline", "titre professionnel"],
  ["companyName", "entreprise"],
  ["businessDescription", "activité"],
  ["targetAudience", "audience"],
  ["market", "marché"],
  ["commGoals", "objectifs"],
  ["styleNotes", "consignes de style"],
];

const excerpt = (t) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > 110 ? `${s.slice(0, 110).trimEnd()}…` : s;
};

export async function generationContext(userId, topic) {
  const empty = { profile: { filled: [], missing: PROFILE_FIELDS.map(([, l]) => l) }, sources: [], remarks: [], posts: [], totals: { sources: 0, posts: 0 } };
  if (!userId) return empty;
  const select = Object.fromEntries(PROFILE_FIELDS.map(([k]) => [k, true]));
  select.styleExamples = true;
  const [user, sources, remarks, imported, published] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select }),
    prisma.knowledgeSource
      .findMany({ where: { userId }, select: { id: true, kind: true, title: true, origin: true, summary: true, facts: true, pinned: true }, orderBy: { createdAt: "desc" } })
      .catch(() => []),
    getRemarks(userId).catch(() => []),
    prisma.stylePost.findMany({ where: { userId }, select: { text: true }, orderBy: { createdAt: "desc" }, take: MAX_POSTS }).catch(() => []),
    prisma.draft.findMany({ where: { userId, status: "publié" }, select: { text: true }, orderBy: { publishedAt: "desc" }, take: MAX_POSTS }).catch(() => []),
  ]);
  const filled = PROFILE_FIELDS.filter(([k]) => user?.[k]).map(([, l]) => l);
  const missing = PROFILE_FIELDS.filter(([k]) => !user?.[k]).map(([, l]) => l);
  const picked = pickSources(sources, topic ?? "");
  const corpus = [...imported, ...published].map((p) => p.text);
  const posts = chooseExamples(corpus, parseExamples(user?.styleExamples), topic ?? "");
  return {
    profile: { filled, missing },
    sources: picked.map((s) => ({ id: s.id, title: s.title, pinned: Boolean(s.pinned) })),
    remarks: remarks.map((r) => r.text),
    posts: posts.map(excerpt),
    totals: { sources: sources.length, posts: corpus.length },
  };
}
