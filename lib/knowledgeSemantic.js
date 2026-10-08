import { prisma } from "./db";
import { embedTexts, cosineSimilarity } from "./editorial/embeddings";
import { parseFacts, parseInsights, pickSources } from "./knowledgeText";

// Recherche par sens dans le datalake : chaque source a un vecteur (calculé une fois, relu ensuite) ;
// le sujet est vectorisé à chaque demande. Sans clé d'embeddings ou en cas d'erreur, on retombe sur les mots seuls.

const MAX_TEXT = 2000;
const BATCH = 40;
const topicCache = new Map(); // sujet → vecteur (évite de re-vectoriser le même sujet pendant la saisie)

export function sourceEmbeddingText(s) {
  const ins = parseInsights(s.insights);
  return [s.title, s.summary, ins?.themes?.join(", "), parseFacts(s.facts).join(" ")].filter(Boolean).join("\n").slice(0, MAX_TEXT);
}

async function topicVector(topic) {
  const key = String(topic).slice(0, 600);
  if (topicCache.has(key)) return topicCache.get(key);
  const v = await embedTexts([key]);
  if (!v) return null;
  if (topicCache.size > 200) topicCache.delete(topicCache.keys().next().value);
  topicCache.set(key, v[0]);
  return v[0];
}

// Complète les vecteurs manquants (un seul appel) et les enregistre. Renvoie Map id → vecteur, ou null si indisponible.
export async function ensureEmbeddings(sources) {
  const vectors = new Map(sources.filter((s) => Array.isArray(s.embedding)).map((s) => [s.id, s.embedding]));
  const missing = sources.filter((s) => !vectors.has(s.id) && (s.summary || s.facts)).slice(0, BATCH);
  if (missing.length) {
    const out = await embedTexts(missing.map(sourceEmbeddingText));
    if (!out) return vectors.size ? vectors : null;
    await Promise.all(
      missing.map((s, i) => {
        vectors.set(s.id, out[i]);
        return prisma.knowledgeSource.update({ where: { id: s.id }, data: { embedding: out[i] } }).catch(() => {});
      })
    );
  }
  return vectors;
}

// Proximité de chaque source avec le sujet : Map id → cosinus, ou null (mots seuls)
export async function semanticScores(sources, topic) {
  const q = String(topic ?? "").trim();
  if (!q || !sources.length) return null;
  try {
    const [vectors, tv] = await Promise.all([ensureEmbeddings(sources), topicVector(q)]);
    if (!vectors || !tv) return null;
    return new Map(sources.filter((s) => vectors.has(s.id)).map((s) => [s.id, cosineSimilarity(tv, vectors.get(s.id))]));
  } catch (e) {
    console.error("[datalake] recherche par sens indisponible :", e.message);
    return null;
  }
}

// Sources retenues pour un sujet : par le sens ET par les mots
export async function pickSourcesSemantic(sources, topic, opts = {}) {
  return pickSources(sources, topic, { ...opts, sims: await semanticScores(sources, topic) });
}
