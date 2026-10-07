import { prisma } from "./db";
import { tokens } from "./knowledgeText";
import { cleanPost, parseExamples, styleExamplesBlockFromList, MAX_EXAMPLES, EXAMPLE_CHARS, MAX_POSTS } from "./postImport";

// Corpus de posts de l'auteur : anciens posts importés (StylePost) et posts publiés depuis l'application.
// Pour chaque rédaction, on retient les posts les plus proches du sujet comme exemples de voix.

export const MIN_CORPUS_CHARS = 20;

// Classe des textes selon leur proximité avec le sujet (TF-IDF local, déterministe) : [{ text, score }]
export function rankPosts(texts, topic) {
  const q = new Set(tokens(topic));
  const docs = texts.map((text) => {
    const tf = new Map();
    for (const t of tokens(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { text, tf };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  return docs
    .map(({ text, tf }) => {
      let score = 0;
      for (const t of q) {
        const f = tf.get(t);
        if (f) score += Math.log(1 + n / df.get(t)) * (1 + Math.log(f));
      }
      return { text, score };
    })
    .sort((a, b) => b.score - a.score);
}

// Exemples d'un prompt : d'abord les posts du corpus qui touchent au sujet, puis les posts types
// conservés à l'import pour compléter (jamais deux fois le même texte).
export function chooseExamples(corpus, fixed, topic, max = MAX_EXAMPLES) {
  const clean = (t) => cleanPost(t).slice(0, EXAMPLE_CHARS);
  const pool = [...new Set(corpus.map(clean).filter((t) => t.length >= MIN_CORPUS_CHARS))];
  const related = rankPosts(pool, topic).filter((r) => r.score > 0).map((r) => r.text);
  const out = [];
  for (const t of [...related, ...fixed.map(clean)]) {
    if (t.length >= MIN_CORPUS_CHARS && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

// Bloc d'exemples pour un prompt de rédaction ; vide sans exemple. Ne casse jamais la génération.
export async function styleExamplesFor(userId, topic, fixedJson) {
  const fixed = parseExamples(fixedJson);
  if (!userId) return styleExamplesBlockFromList(fixed);
  try {
    const [imported, published] = await Promise.all([
      prisma.stylePost.findMany({ where: { userId }, select: { text: true }, orderBy: { createdAt: "desc" }, take: MAX_POSTS }),
      prisma.draft.findMany({ where: { userId, status: "publié" }, select: { text: true }, orderBy: { publishedAt: "desc" }, take: MAX_POSTS }),
    ]);
    return styleExamplesBlockFromList(chooseExamples([...imported, ...published].map((p) => p.text), fixed, topic));
  } catch (e) {
    console.error("[style] sélection des exemples impossible :", e.message);
    return styleExamplesBlockFromList(fixed);
  }
}
