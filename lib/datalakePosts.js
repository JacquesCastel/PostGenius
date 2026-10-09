import { prisma } from "./db";
import { cleanPost } from "./postImport";

// Posts de l'auteur dans le datalake : ceux publiés depuis l'application (propres à l'entreprise) et les anciens posts
// importés (valent pour toutes). Lus en direct, jamais recopiés : rien à ajouter, rien ne compte dans le quota de sources.
const excerpt = (t, n) => cleanPost(t).replace(/\s+/g, " ").slice(0, n);

export async function postsOverview(userId, contextId = null) {
  const where = { userId, status: "publié", contextId: contextId ?? null };
  const [published, planned, imported, recent] = await Promise.all([
    prisma.draft.count({ where }),
    prisma.draft.count({ where: { userId, contextId: contextId ?? null, status: { in: ["programmé", "à valider"] } } }),
    prisma.stylePost.count({ where: { userId } }),
    prisma.draft.findMany({ where, select: { id: true, text: true, publishedAt: true }, orderBy: { publishedAt: "desc" }, take: 5 }),
  ]);
  return { published, planned, imported, recent: recent.map((p) => ({ id: p.id, excerpt: excerpt(p.text, 160), publishedAt: p.publishedAt })) };
}

// Extraits des posts récents (publiés pour cette entreprise, puis importés) : donnent le ton réel aux propositions de langage
export async function recentPostExcerpts(userId, contextId = null, n = 8) {
  try {
    const [published, imported] = await Promise.all([
      prisma.draft.findMany({ where: { userId, status: { in: ["publié", "programmé", "à valider"] }, contextId: contextId ?? null }, select: { text: true }, orderBy: { createdAt: "desc" }, take: n }),
      prisma.stylePost.findMany({ where: { userId }, select: { text: true }, orderBy: { createdAt: "desc" }, take: n }),
    ]);
    return [...published, ...imported].map((p) => excerpt(p.text, 300)).filter((t) => t.length >= 30).slice(0, n);
  } catch (e) {
    console.error("[datalake] posts récents illisibles :", e.message);
    return [];
  }
}
