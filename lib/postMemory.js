import { prisma } from "./db";
import { embedTexts, cosineSimilarity } from "./editorial/embeddings";
import { textHash, pickMemory, memoryBlock } from "./postMemoryText";

// Mémoire éditoriale d'une entreprise (nul = principale) : posts publiés, programmés ou à valider.
// Recherche par le sens (vecteur du texte calculé une fois, relu tant que le texte ne change pas), repli sur les mots.
const STATUSES = ["publié", "programmé", "à valider"];
const POOL = 80;
const topicCache = new Map();

async function simsFor(posts, topic) {
  const q = String(topic ?? "").trim().slice(0, 600);
  if (!q || !posts.length) return null;
  try {
    const vectors = new Map();
    const missing = [];
    for (const p of posts) {
      const e = p.embedding;
      if (e && e.h === textHash(p.text) && Array.isArray(e.v)) vectors.set(p.id, e.v);
      else missing.push(p);
    }
    const batch = missing.slice(0, 40);
    let tv = topicCache.get(q);
    const texts = [...(tv ? [] : [q]), ...batch.map((p) => String(p.text).slice(0, 2000))];
    if (texts.length) {
      const out = await embedTexts(texts);
      if (!out) return vectors.size ? null : null;
      let k = 0;
      if (!tv) {
        tv = out[k++];
        if (topicCache.size > 200) topicCache.delete(topicCache.keys().next().value);
        topicCache.set(q, tv);
      }
      await Promise.all(batch.map((p) => {
        const v = out[k++];
        vectors.set(p.id, v);
        return prisma.draft.update({ where: { id: p.id }, data: { embedding: { h: textHash(p.text), v } } }).catch(() => {});
      }));
    }
    return new Map(posts.filter((p) => vectors.has(p.id)).map((p) => [p.id, cosineSimilarity(tv, vectors.get(p.id))]));
  } catch (e) {
    console.error("[mémoire] recherche par sens indisponible :", e.message);
    return null;
  }
}

// Bloc de prompt « ce que l'auteur a déjà dit » ; vide sans post. Ne casse jamais la rédaction.
export async function memoryFor(userId, topic, { contextId = null, excludeDraftId = null } = {}) {
  if (!userId) return { block: "", picked: [] };
  try {
    const posts = await prisma.draft.findMany({
      where: { userId, contextId: contextId ?? null, status: { in: STATUSES }, ...(excludeDraftId ? { NOT: { id: excludeDraftId } } : {}) },
      select: { id: true, text: true, status: true, target: true, publishedAt: true, scheduledAt: true, createdAt: true, embedding: true },
      orderBy: { createdAt: "desc" },
      take: POOL,
    });
    if (!posts.length) return { block: "", picked: [] };
    const picked = pickMemory(posts, topic, await simsFor(posts, topic));
    return { block: memoryBlock(picked), picked };
  } catch (e) {
    console.error("[mémoire] indisponible :", e.message);
    return { block: "", picked: [] };
  }
}
