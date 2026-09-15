// Similarité sémantique par embeddings (OpenAI text-embedding-3-small) —
// remplace la similarité par recouvrement de mots pour l'anti-répétition :
// détecte les reformulations d'un même sujet, pas seulement les mots partagés.
// Pas d'entraînement : modèle pré-entraîné, aucune donnée à accumuler pour
// être utile dès le premier appel (contrairement à un score d'engagement
// appris, voir lib/editorial/learning.js pour pourquoi ce n'est pas encore
// pertinent avec le volume de données actuel).

const EMBED_MODEL = "text-embedding-3-small";

export async function embedTexts(texts) {
  if (!process.env.OPENAI_API_KEY || !texts.length) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    });
    if (!res.ok) {
      console.error("Embeddings OpenAI:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.data.map((d) => d.embedding);
  } catch (e) {
    console.error("Erreur embeddings:", e.message);
    return null;
  }
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Similarité sémantique max d'un texte candidat face à une liste de textes
// récents. Renvoie null si les embeddings sont indisponibles (clé absente,
// erreur réseau) — l'appelant doit alors retomber sur un score par défaut.
export async function maxSemanticSimilarity(candidate, recentTexts) {
  if (!recentTexts.length) return 0;
  const vectors = await embedTexts([candidate, ...recentTexts]);
  if (!vectors) return null;
  const [candidateVec, ...recentVecs] = vectors;
  return Math.max(...recentVecs.map((v) => cosineSimilarity(candidateVec, v)));
}
