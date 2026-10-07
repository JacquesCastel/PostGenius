import { CTA_REGEX } from "./linkedinRules";

// Import des anciens posts d'un utilisateur : lecture du fichier d'export LinkedIn (Shares.csv) ou de
// posts collés à la main, puis mesures de style. PUR : aucune dépendance serveur, testable seul.

export const MAX_POSTS = 50;
export const MAX_POST_CHARS = 1500; // au-delà, un post est tronqué avant l'analyse
export const MAX_INPUT_CHARS = 600_000;
const MIN_POST_CHARS = 20;

// --- Lecture CSV (RFC 4180) : guillemets, guillemets doublés, retours à la ligne dans un champ ------
export function parseCsv(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = String(text ?? "").replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Texte d'un post : retire les caractères de contrôle, normalise les fins de ligne
export function cleanPost(t) {
  return String(t ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_POST_CHARS);
}

// Le fichier ressemble-t-il à l'export LinkedIn (en-tête avec ShareCommentary) ?
export function looksLikeSharesCsv(text) {
  const head = String(text ?? "").replace(/^﻿/, "").slice(0, 600);
  return /sharecommentary/i.test(head.split(/\r?\n/)[0] ?? "") || /"?ShareLink"?\s*[,;]\s*"?ShareCommentary/i.test(head);
}

// Export LinkedIn « Shares.csv » : colonnes Date, ShareLink, ShareCommentary, SharedUrl, MediaUrl, Visibility.
// Renvoie les MAX_POSTS posts les plus récents ayant un texte : [{ date, text }]
export function extractPostsFromShares(csv) {
  const headLine = String(csv ?? "").replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (headLine.match(/;/g)?.length ?? 0) > (headLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = parseCsv(csv, delimiter);
  if (rows.length < 2) return [];
  const header = rows[0].map(norm);
  const iText = header.findIndex((h) => h === "sharecommentary" || h === "commentary");
  const iDate = header.findIndex((h) => h === "date");
  if (iText < 0) return [];
  const posts = rows
    .slice(1)
    .map((r) => ({ date: iDate >= 0 ? r[iDate] || null : null, text: cleanPost(r[iText]) }))
    .filter((p) => p.text.length >= MIN_POST_CHARS);
  const time = (p) => (p.date ? Date.parse(String(p.date).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(p.date) ? "" : "Z")) : NaN);
  const dated = posts.every((p) => Number.isFinite(time(p)));
  // Les plus récents d'abord (l'export est déjà trié ainsi en général, mais on ne s'y fie pas)
  if (dated) posts.sort((a, b) => time(b) - time(a));
  return posts.slice(0, MAX_POSTS);
}

// Posts collés : séparés par une ligne « --- » (ou ===, ***, ___). Sans séparateur, le texte est un seul post.
export function parsePastedPosts(text) {
  const chunks = String(text ?? "")
    .split(/^[ \t]*(?:-{3,}|={3,}|\*{3,}|_{3,})[ \t]*$/m)
    .map(cleanPost)
    .filter((t) => t.length >= MIN_POST_CHARS);
  return chunks.slice(0, MAX_POSTS).map((t) => ({ date: null, text: t }));
}

// Point d'entrée : fichier d'export LinkedIn ou posts collés, détectés automatiquement
export function extractPosts(raw) {
  const text = String(raw ?? "").slice(0, MAX_INPUT_CHARS);
  return looksLikeSharesCsv(text) ? extractPostsFromShares(text) : parsePastedPosts(text);
}

// --- Mesures de style ---------------------------------------------------------------------------
const EMOJI = /\p{Extended_Pictographic}/gu;
const HASHTAG = /#[\p{L}0-9_]+/gu;

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

export function styleStats(posts) {
  const n = posts.length;
  const texts = posts.map((p) => p.text);
  const lengths = texts.map((t) => t.length);
  const emojis = texts.map((t) => (t.match(EMOJI) || []).length);
  const hashtags = texts.map((t) => (t.match(HASHTAG) || []).length);
  const endsWithQuestion = texts.filter((t) => /[?？]\s*(#[\p{L}0-9_]+\s*)*$/u.test(t.trim())).length;
  return {
    count: n,
    medianChars: median(lengths),
    medianLines: median(texts.map((t) => t.split("\n").filter((l) => l.trim()).length)),
    withEmojiPct: pct(emojis.filter((e) => e > 0).length, n),
    avgEmojis: n ? Math.round((emojis.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
    withHashtagsPct: pct(hashtags.filter((h) => h > 0).length, n),
    medianHashtags: median(hashtags),
    endsWithQuestionPct: pct(endsWithQuestion, n),
    withCtaPct: pct(texts.filter((t) => CTA_REGEX.test(t)).length, n),
  };
}

// --- Exemples conservés (3 posts max) et leur injection dans les prompts de rédaction -------------
export const MAX_EXAMPLES = 3;
export const EXAMPLE_CHARS = 1000;

export function serializeExamples(texts) {
  const list = (Array.isArray(texts) ? texts : [])
    .map((t) => cleanPost(t).slice(0, EXAMPLE_CHARS))
    .filter((t) => t.length >= MIN_POST_CHARS)
    .slice(0, MAX_EXAMPLES);
  return list.length ? JSON.stringify(list) : null;
}

export function parseExamples(json) {
  try {
    const a = JSON.parse(json || "[]");
    return Array.isArray(a) ? a.filter((t) => typeof t === "string" && t.trim()).slice(0, MAX_EXAMPLES) : [];
  } catch {
    return [];
  }
}

// Bloc ajouté aux prompts de rédaction ; vide sans exemples
export function styleExamplesBlockFromList(list) {
  const ex = (Array.isArray(list) ? list : []).filter((t) => typeof t === "string" && t.trim()).slice(0, MAX_EXAMPLES);
  if (!ex.length) return "";
  return `\n- Exemples de posts écrits par l'auteur : imite sa voix (structure, rythme, vocabulaire, façon d'ouvrir et de conclure) sans jamais recopier leurs phrases ni réutiliser leurs idées :\n${ex
    .map((t, i) => `  Exemple ${i + 1} :\n  """\n${t.split("\n").map((l) => `  ${l}`).join("\n")}\n  """`)
    .join("\n")}`;
}

export const styleExamplesBlock = (json) => styleExamplesBlockFromList(parseExamples(json));
