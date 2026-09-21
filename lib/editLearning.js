// Apprentissage des habitudes d'édition : compare le texte produit par l'IA au texte
// final de l'utilisateur pour repérer ce qu'il retire ou ajoute systématiquement.
// PUR (ni base de données ni appel IA) : testable seul. L'orchestration est dans
// lib/remarkSuggestions.js.
//
// Deux sources de suggestions, toutes deux vérifiables :
// - règles chiffrées (émojis, longueur, hashtags, question finale) : le texte proposé et la
//   preuve affichée à l'utilisateur sont calculés, jamais devinés ;
// - motifs de fond ou de style repérés par un modèle de langage, gardés seulement si la
//   citation qu'il donne existe réellement dans les modifications observées.

export const MIN_MODIFIED = 3; // posts modifiés nécessaires avant de proposer quoi que ce soit
export const NEW_TRIGGER = 2; // nouveaux posts modifiés depuis la dernière analyse pour la relancer
export const MAX_PAIRS = 20; // derniers brouillons examinés
const MAJORITY = 0.6; // un motif doit toucher au moins 60 % des posts modifiés (et 2 posts)

const EMOJI = /\p{Extended_Pictographic}/gu;
const HASHTAG = /#[\p{L}0-9_]+/gu;
const count = (t, re) => (t.match(re) || []).length;
const norm = (l) => l.toLowerCase().replace(/\s+/g, " ").trim();
// Clé de comparaison de contenu : sans émojis, car ils sont analysés à part. Une ligne qui
// ne diffère que par un émoji n'est pas une modification de fond.
const contentKey = (l) => norm(l.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ""));
const textLines = (t) => t.split("\n").map((l) => l.trim()).filter(Boolean);
const isHashtagLine = (l) => /^(#[\p{L}0-9_]+\s*)+$/u.test(l);

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Différences entre le texte de l'IA et le texte final : lignes retirées / ajoutées et
// quelques mesures. Les changements de simple casse ou d'espaces ne comptent pas.
export function comparePair(generated, final) {
  const g = (generated || "").trim();
  const f = (final || "").trim();
  const gl = textLines(g);
  const fl = textLines(f);
  const gset = new Set(gl.map(contentKey));
  const fset = new Set(fl.map(contentKey));
  const removed = gl.filter((l) => !fset.has(contentKey(l)));
  const added = fl.filter((l) => !gset.has(contentKey(l)));
  const emojis = [count(g, EMOJI), count(f, EMOJI)];
  const hashtags = [count(g, HASHTAG), count(f, HASHTAG)];
  return {
    // modifié = du contenu a changé, ou des émojis / hashtags ont été ajoutés ou retirés
    changed: removed.length + added.length > 0 || emojis[0] !== emojis[1] || hashtags[0] !== hashtags[1],
    chars: [g.length, f.length],
    emojis,
    hashtags,
    questions: [count(g, /\?/g), count(f, /\?/g)],
    removed,
    added,
  };
}

// Suggestions déterministes : motif présent dans au moins 60 % des posts modifiés.
export function statSuggestions(pairs) {
  const n = pairs.length;
  if (n < MIN_MODIFIED) return [];
  const need = Math.max(2, Math.ceil(MAJORITY * n));
  const out = [];
  const label = `de vos ${n} derniers posts modifiés`;

  // Émojis
  const emojiLess = pairs.filter((p) => p.emojis[1] < p.emojis[0]).length;
  const emojiMore = pairs.filter((p) => p.emojis[1] > p.emojis[0]).length;
  if (emojiLess >= need) {
    const med = Math.round(median(pairs.map((p) => p.emojis[1])));
    out.push({
      key: "emojis",
      text: med === 0 ? "N'utilise aucun émoji." : `Utilise très peu d'émojis (${med} au maximum).`,
      evidence: `Vous avez retiré des émojis dans ${emojiLess} ${label}.`,
    });
  } else if (emojiMore >= need) {
    out.push({
      key: "emojis",
      text: "Utilise davantage d'émojis (3 à 6 par post).",
      evidence: `Vous avez ajouté des émojis dans ${emojiMore} ${label}.`,
    });
  }

  // Longueur : écart d'au moins 10 % entre le texte de l'IA et le texte final
  const ratios = pairs.map((p) => (p.chars[0] ? (p.chars[1] - p.chars[0]) / p.chars[0] : 0));
  const shorter = ratios.filter((r) => r <= -0.1);
  const longer = ratios.filter((r) => r >= 0.1);
  const target = Math.max(200, Math.round(median(pairs.map((p) => p.chars[1])) / 50) * 50);
  if (shorter.length >= need) {
    const pct = Math.round((shorter.reduce((a, r) => a + Math.abs(r), 0) / shorter.length) * 100);
    out.push({
      key: "length",
      text: `Écris des posts plus courts : environ ${target} caractères.`,
      evidence: `Vous avez raccourci ${shorter.length} ${label} (de ${pct} % en moyenne).`,
    });
  } else if (longer.length >= need) {
    const pct = Math.round((longer.reduce((a, r) => a + r, 0) / longer.length) * 100);
    out.push({
      key: "length",
      text: `Écris des posts plus développés : environ ${target} caractères.`,
      evidence: `Vous avez allongé ${longer.length} ${label} (de ${pct} % en moyenne).`,
    });
  }

  // Hashtags retirés
  const hashLess = pairs.filter((p) => p.hashtags[1] < p.hashtags[0]).length;
  if (hashLess >= need) {
    const med = Math.round(median(pairs.map((p) => p.hashtags[1])));
    out.push({
      key: "hashtags",
      text: med === 0 ? "N'ajoute aucun hashtag." : `Limite-toi à ${med} hashtag${med > 1 ? "s" : ""}.`,
      evidence: `Vous avez retiré des hashtags dans ${hashLess} ${label}.`,
    });
  }

  // Question finale retirée
  const qDropped = pairs.filter((p) => p.questions[0] > 0 && p.questions[1] === 0).length;
  if (qDropped >= need) {
    out.push({
      key: "question",
      text: "Ne termine pas les posts par une question.",
      evidence: `Vous avez retiré toutes les questions de ${qDropped} ${label}.`,
    });
  }

  return out;
}

// Extraits soumis au modèle de langage : uniquement des lignes de contenu (les émojis, la
// longueur et les hashtags sont déjà couverts par les règles chiffrées).
export function buildExcerpts(pairs, { maxPosts = 6, maxLines = 3, maxLen = 180 } = {}) {
  const clip = (l) => (l.length > maxLen ? l.slice(0, maxLen) + "…" : l);
  return pairs
    .map((p) => ({
      removed: p.removed.filter((l) => !isHashtagLine(l)).slice(0, maxLines).map(clip),
      added: p.added.filter((l) => !isHashtagLine(l)).slice(0, maxLines).map(clip),
    }))
    .filter((e) => e.removed.length || e.added.length)
    .slice(0, maxPosts)
    .map((e, i) => ({ id: i + 1, ...e }));
}

export function suggestionPrompt({ excerpts, known }) {
  const blocks = excerpts
    .map(
      (e) =>
        `[${e.id}]${e.removed.length ? `\n  Supprimé de la version IA :\n${e.removed.map((l) => `    « ${l} »`).join("\n")}` : ""}${
          e.added.length ? `\n  Ajouté par l'auteur :\n${e.added.map((l) => `    « ${l} »`).join("\n")}` : ""
        }`
    )
    .join("\n\n");
  return `Voici des modifications qu'un auteur a faites à des posts LinkedIn rédigés par une IA avant de les publier.

${blocks}

Cherche des habitudes de FOND ou de STYLE qui se répètent dans au moins 2 posts différents (ex : une formule d'appel à l'action toujours supprimée, un ton remplacé, une structure réorganisée, tutoiement ou vouvoiement corrigé). Ignore la longueur, les émojis et les hashtags (déjà analysés ailleurs).
Sois PRÉCIS : la consigne décrit uniquement ce que les extraits montrent, sans la généraliser (si l'auteur retire une formule précise, la consigne vise cette formule, pas toute une catégorie).
${known.length ? `\nRemarques déjà enregistrées ou refusées (ne les répète pas, même reformulées) :\n${known.map((k) => `- ${k}`).join("\n")}\n` : ""}
Propose 0 à 2 remarques durables. Chacune :
- "text" : consigne adressée à l'IA rédactrice, à l'impératif, 160 caractères maximum ;
- "quote" : citation EXACTE copiée mot pour mot d'une ligne ci-dessus qui illustre l'habitude ;
- "posts" : numéros des posts concernés (au moins 2).
Si aucune habitude claire, réponds {"suggestions": []}. Réponds UNIQUEMENT en JSON : {"suggestions": [{"text": "...", "quote": "...", "posts": [1, 3]}]}`;
}

// Deux citations désignent le même motif si l'une contient l'autre (après normalisation).
export function sameQuote(a, b) {
  const x = norm(String(a || "").replace(/[«»"]/g, ""));
  const y = norm(String(b || "").replace(/[«»"]/g, ""));
  return x.length >= 6 && y.length >= 6 && (x.includes(y) || y.includes(x));
}

// Ne garde que les suggestions du modèle vérifiables : au moins 2 posts existants et une
// citation réellement présente dans les extraits de l'un d'eux.
export function parseLlmSuggestions(raw, excerpts) {
  let parsed;
  try {
    const match = String(raw).match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed?.suggestions)) return [];
  const byId = new Map(excerpts.map((e) => [e.id, e]));
  const stripQuotes = (s) => norm(String(s).replace(/[«»"]/g, ""));
  const out = [];
  for (const s of parsed.suggestions.slice(0, 2)) {
    const text = typeof s?.text === "string" ? s.text.trim().slice(0, 200) : "";
    const quote = typeof s?.quote === "string" ? stripQuotes(s.quote) : "";
    const posts = [...new Set((Array.isArray(s?.posts) ? s.posts : []).map(Number))].filter((id) => byId.has(id));
    if (!text || quote.length < 6 || posts.length < 2) continue;
    const found = posts.some((id) => {
      const e = byId.get(id);
      return [...e.removed, ...e.added].some((l) => stripQuotes(l).includes(quote));
    });
    if (!found) continue;
    out.push({
      key: "llm",
      quote: String(s.quote).replace(/[«»]/g, "").trim().slice(0, 200),
      text,
      evidence: `Vous avez modifié ce point dans ${posts.length} de vos derniers posts (ex. : « ${String(s.quote).replace(/[«»]/g, "").trim().slice(0, 100)} »).`,
    });
  }
  return out;
}
