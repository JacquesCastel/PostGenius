// Base de connaissances : outils PURS (aucune base de données, aucun appel réseau) : extraction du texte
// d'une page web, sélection des sources pertinentes pour un sujet, vérification des chiffres et bloc de
// prompt. Testable seul.

export const MAX_TEXT_CHARS = 60_000; // texte conservé par source
export const ANALYSIS_CHARS = 30_000; // part du texte envoyée à l'IA pour le résumé
export const MAX_FACTS = 12;
export const MAX_FACT_CHARS = 240;
export const MAX_PICKED = 5; // sources injectées dans un prompt de rédaction
export const MAX_PINNED = 3;
export const FACTS_PER_SOURCE = 8;

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&rsquo;": "'", "&lsquo;": "'", "&rdquo;": '"', "&ldquo;": '"', "&laquo;": "«", "&raquo;": "»", "&hellip;": "…", "&ndash;": "–", "&mdash;": "—", "&eacute;": "é", "&egrave;": "è", "&agrave;": "à", "&ecirc;": "ê", "&ccedil;": "ç" };
export function decodeEntities(s) {
  return String(s ?? "")
    .replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : " "; })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const c = parseInt(h, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : " "; })
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ");
}

// Page web → { title, text } : titre (og:title ou <title>) et texte lisible. On privilégie <article> puis
// <main>, puis le corps de la page ; scripts, styles, menus, bas de page et formulaires sont retirés.
export function htmlToText(html) {
  const src = String(html ?? "");
  const metaTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(src)?.[1]
    ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(src)?.[1] ?? "";
  const title = decodeEntities(metaTitle).replace(/\s+/g, " ").trim().slice(0, 160);
  let body = src.replace(/<(script|style|noscript|template|svg|iframe|form|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const pick = (tag) => {
    const parts = [...body.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((m) => m[1]);
    return parts.length ? parts.reduce((a, b) => (b.length > a.length ? b : a)) : "";
  };
  const main = pick("article") || pick("main");
  if (main.replace(/<[^>]+>/g, "").trim().length > 400) body = main;
  const text = decodeEntities(
    body
      .replace(/<\/(p|div|section|li|h[1-6]|tr|blockquote|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text: text.slice(0, MAX_TEXT_CHARS) };
}

export const cleanText = (t) =>
  String(t ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_CHARS);

// --- Vérification des faits : aucun chiffre ne doit être inventé ------------------------------------
// Nombres d'un texte : chaque suite de chiffres, et sa forme « groupée » (« 1 250 000 », « 1.250.000 » → 1250000).
const runs = (s) => String(s).match(/\d+/g) ?? [];
const merged = (s) => (String(s).match(/\d+(?:[\s\u00a0.,]\d{3})*/g) ?? []).map((m) => m.replace(/\D/g, ""));
// Un fait est conservé seulement si TOUS ses nombres (même d'un seul chiffre) figurent dans la source.
export function factIsGrounded(fact, sourceText) {
  const known = new Set([...runs(sourceText), ...merged(sourceText)]);
  const groups = String(fact).match(/\d+(?:[\s\u00a0.,]\d{3})*/g) ?? [];
  return groups.every((g) => known.has(g.replace(/\D/g, "")) || runs(g).every((r) => known.has(r)));
}

export function normalizeFacts(raw, sourceText) {
  const out = [];
  for (const f of Array.isArray(raw) ? raw : []) {
    const t = String(f ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_FACT_CHARS);
    if (t.length < 8 || out.includes(t) || !factIsGrounded(t, sourceText)) continue;
    out.push(t);
    if (out.length >= MAX_FACTS) break;
  }
  return out;
}

// --- Lecture éditoriale d'une source : thèmes, vocabulaire propre, positions défendues ---------------
export const MAX_THEMES = 6;
export const MAX_VOCAB = 10;
export const MAX_POSITIONS = 5;
const squash = (t, n) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "'");
const uniq = (list, max, ok = () => true) => {
  const seen = new Set();
  const out = [];
  for (const t of list) {
    const k = norm(t);
    if (!t || seen.has(k) || !ok(t)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
};
// Le vocabulaire doit figurer dans le texte (jamais d'expression inventée) ; thèmes et positions sont des synthèses libres.
export function normalizeInsights(raw, sourceText) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const hay = norm(sourceText);
  return {
    themes: uniq(arr(raw?.themes).map((t) => squash(t, 40)), MAX_THEMES, (t) => t.length >= 3),
    vocabulary: uniq(arr(raw?.vocabulary).map((t) => squash(t, 60)), MAX_VOCAB, (t) => t.length >= 3 && hay.includes(norm(t))),
    positions: uniq(arr(raw?.positions).map((t) => squash(t, 220)), MAX_POSITIONS, (t) => t.length >= 15),
  };
}
export function parseInsights(json) {
  try {
    const v = JSON.parse(json ?? "null");
    if (!v || typeof v !== "object") return null;
    return {
      themes: Array.isArray(v.themes) ? v.themes.map(String) : [],
      vocabulary: Array.isArray(v.vocabulary) ? v.vocabulary.map(String) : [],
      positions: Array.isArray(v.positions) ? v.positions.map(String) : [],
    };
  } catch {
    return null;
  }
}
// Synthèse de plusieurs sources : éléments classés par nombre de sources qui les portent.
export function aggregateInsights(sources, { themes = 12, vocabulary = 16, positions = 8 } = {}) {
  const tally = (pick, max) => {
    const m = new Map();
    for (const s of sources) {
      for (const t of new Set((s.insights?.[pick] ?? []).map((x) => x))) {
        const k = norm(t);
        const cur = m.get(k) ?? { text: t, count: 0, sources: [] };
        cur.count++;
        cur.sources.push(s.title);
        m.set(k, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.count - a.count).slice(0, max);
  };
  return { themes: tally("themes", themes), vocabulary: tally("vocabulary", vocabulary), positions: tally("positions", positions) };
}

// --- Pertinence : TF-IDF local, gratuit et déterministe -----------------------------------------------
const STOP = new Set(("le la les un une des du de d l et ou en au aux a à ce cet cette ces se sa son ses sur dans par pour avec sans qui que quoi dont où est sont être été a ont avoir pas plus ne nous vous ils elle elles il je tu on mon ma mes ton ta tes notre votre leur leurs the and for with that this from are was were have has not you your our their its of to in on at by as is it be or an a").split(/\s+/));

export function tokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
    .map((t) => t.slice(0, 6)); // racine grossière : « campagnes » et « campagne » se rejoignent
}

// Texte indexé d'une source : titre (compté deux fois), résumé et faits
const indexText = (s) => `${s.title} ${s.title} ${s.summary ?? ""} ${parseFacts(s.facts).join(" ")}`;

export function parseFacts(json) {
  try {
    const a = JSON.parse(json || "[]");
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Classe les sources selon leur proximité avec le sujet ; renvoie [{ source, score }] décroissant.
export function rankSources(sources, topic) {
  const q = new Set(tokens(topic));
  if (!q.size || !sources.length) return sources.map((source) => ({ source, score: 0 }));
  const docs = sources.map((s) => {
    const tf = new Map();
    for (const t of tokens(indexText(s))) tf.set(t, (tf.get(t) ?? 0) + 1);
    return tf;
  });
  const df = new Map();
  for (const tf of docs) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = sources.length;
  return sources
    .map((source, i) => {
      let score = 0;
      for (const t of q) {
        const f = docs[i].get(t);
        if (f) score += Math.log(1 + n / df.get(t)) * (1 + Math.log(f));
      }
      return { source, score };
    })
    .sort((a, b) => b.score - a.score);
}

// Sources injectées : d'abord celles épinglées (« toujours utiliser »), puis les plus pertinentes (score > 0)
export function pickSources(sources, topic, { max = MAX_PICKED } = {}) {
  const ready = sources.filter((s) => s.summary || parseFacts(s.facts).length);
  const pinned = ready.filter((s) => s.pinned).slice(0, MAX_PINNED);
  const ranked = rankSources(ready.filter((s) => !pinned.includes(s)), topic).filter((r) => r.score > 0);
  return [...pinned, ...ranked.map((r) => r.source)].slice(0, max);
}

// Bloc ajouté aux prompts de rédaction ; vide sans source retenue. Les sources sont numérotées [S1], [S2]…
export function knowledgeBlock(picked) {
  if (!picked.length) return "";
  const body = picked
    .map((s, i) => {
      const facts = parseFacts(s.facts).slice(0, FACTS_PER_SOURCE);
      return `[S${i + 1}] ${s.title}${s.origin && s.kind === "link" ? ` (${s.origin})` : ""}\n${s.summary ? `Résumé : ${s.summary}\n` : ""}${facts.length ? `Faits relevés :\n${facts.map((f) => `- ${f}`).join("\n")}\n` : ""}`;
    })
    .join("\n");
  return `\n\nCONNAISSANCES FOURNIES PAR L'AUTEUR (sources qu'il a lui-même déposées) :
${body}
Règles d'usage de ces sources (À RESPECTER) : tu peux t'appuyer sur ces faits, chiffres et cas pour rendre le post concret. Pour tout chiffre, nom, cas client ou affirmation précise, reprends UNIQUEMENT ce que ces sources disent, sans le déformer ni l'arrondir ; n'invente aucun détail qui n'y figure pas. N'utilise une source que si elle sert vraiment le sujet du post ; sinon ignore-la. N'écris jamais « [S1] » ni le nom d'une source dans le texte du post.`;
}

// Numéros de sources déclarés par le modèle → sources réellement utilisées (bornées aux sources fournies)
export function usedSources(declared, picked) {
  const idx = [...new Set((Array.isArray(declared) ? declared : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= picked.length))];
  return idx.map((n) => ({ id: picked[n - 1].id, title: picked[n - 1].title }));
}

// Vue d'une source pour l'interface (jamais le texte complet)
export const sourceView = (s) => ({
  id: s.id,
  kind: s.kind,
  title: s.title,
  origin: s.origin,
  summary: s.summary,
  facts: parseFacts(s.facts),
  insights: parseInsights(s.insights),
  pinned: s.pinned,
  charCount: s.charCount,
  createdAt: s.createdAt,
  contextId: s.contextId ?? null,
  shared: Boolean(s.shared),
});
