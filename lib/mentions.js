// Mentions LinkedIn dans un post. PUR (navigateur et serveur).
// - Page entreprise : « @Nom » dans le texte + { name, urn } enregistré avec le post ; à la publication, le texte envoyé contient
//   @[Nom](urn:li:organization:ID), format de mention de l'API LinkedIn (le nom doit reprendre celui de la page à l'identique).
// - Personne : l'application ne peut pas retrouver l'identifiant LinkedIn d'un membre ; on repère les « @Prénom Nom » restants
//   pour rappeler au client de les taguer à la main sur LinkedIn.

export const MAX_MENTIONS = 10;
const ORG_URN = /^urn:li:organization:\d+$/;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function sanitizeMentions(list) {
  const out = [];
  for (const m of Array.isArray(list) ? list : []) {
    const name = String(m?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const urn = String(m?.urn ?? "").trim();
    if (!name || !ORG_URN.test(urn) || out.some((x) => x.urn === urn || x.name === name)) continue;
    out.push({ name, urn });
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}
export function parseMentions(json) {
  try {
    return sanitizeMentions(typeof json === "string" ? JSON.parse(json) : json);
  } catch {
    return [];
  }
}

// Adresse, identifiant ou nom court d'une page → { id } ou { vanity } ; null si on n'y reconnaît rien
export function parseOrgRef(input) {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const urn = /urn:li:organization:(\d+)/i.exec(s);
  if (urn) return { id: urn[1] };
  const url = /linkedin\.com\/(?:company|school|showcase)\/([^/?#\s]+)/i.exec(s);
  if (url) {
    const v = decodeURIComponent(url[1]);
    return /^\d+$/.test(v) ? { id: v } : { vanity: v.toLowerCase() };
  }
  if (/^\d{3,}$/.test(s)) return { id: s };
  if (/^[a-z0-9][a-z0-9._%-]{1,99}$/i.test(s)) return { vanity: s.toLowerCase() };
  return null;
}

// Emplacements des mentions de pages dans le texte (première occurrence de « @Nom », non suivie d'une lettre)
function locate(text, list) {
  const found = [];
  for (const m of list) {
    const mt = new RegExp(`(?<![\\p{L}\\p{N}_.])@${escRe(m.name)}(?![\\p{L}\\p{N}])`, "u").exec(text);
    if (mt) found.push({ start: mt.index, end: mt.index + mt[0].length, m });
  }
  found.sort((a, b) => a.start - b.start);
  return found.filter((f, i) => i === 0 || f.start >= found[i - 1].end);
}

// Texte envoyé à LinkedIn : texte échappé, mentions de pages au format @[Nom](urn)
export function buildCommentary(text, mentions, escape) {
  const list = sanitizeMentions(mentions);
  const found = locate(text, list);
  let out = "";
  let pos = 0;
  for (const f of found) {
    out += escape(text.slice(pos, f.start)) + `@[${escape(f.m.name)}](${f.m.urn})`;
    pos = f.end;
  }
  return out + escape(text.slice(pos));
}

const PARTICLE = "(?:de|du|des|la|le|van|von|di|da|el|al|d['’])";
const NAME_RE = new RegExp(`(?<![\\p{L}\\p{N}_.])@(\\p{Lu}[\\p{L}'’-]*(?:\\s+(?:${PARTICLE}\\s*)?\\p{Lu}[\\p{L}'’-]*){0,3})`, "gu");
const HANDLE_RE = /(?<![\p{L}\p{N}_.])@([\p{L}\p{N}][\p{L}\p{N}_.-]{2,})/gu;

// Personnes (ou pages non résolues) écrites « @Nom » dans le texte et à taguer à la main : noms uniques, sans les pages mentionnées
export function findManualTags(text, mentions) {
  const t = String(text ?? "");
  // Toutes les occurrences d'un nom de page sont masquées (seule la première est liée, les suivantes ne sont pas des personnes à taguer)
  let masked = locate(t, sanitizeMentions(mentions)).reduce((s, f) => s.slice(0, f.start) + " ".repeat(f.end - f.start) + s.slice(f.end), t);
  for (const m of sanitizeMentions(mentions)) masked = masked.replace(new RegExp(`(?<![\\p{L}\\p{N}_.])@${escRe(m.name)}(?![\\p{L}\\p{N}])`, "gu"), (x) => " ".repeat(x.length));
  const names = [];
  const seen = new Set();
  const add = (n) => {
    const v = n.replace(/[.'’-]+$/, "").trim();
    const k = v.toLowerCase();
    if (v.length >= 2 && !seen.has(k)) { seen.add(k); names.push(v); }
  };
  let rest = masked;
  for (const m of masked.matchAll(NAME_RE)) { add(m[1]); rest = rest.replace(m[0], " ".repeat(m[0].length)); }
  for (const m of rest.matchAll(HANDLE_RE)) add(m[1]);
  return names.slice(0, 20);
}

// Insère « @Nom » à la position du curseur (ou à la fin), avec les espaces qu'il faut
export function insertMention(text, name, pos = null) {
  const t = String(text ?? "");
  const p = Number.isInteger(pos) && pos >= 0 && pos <= t.length ? pos : t.length;
  const before = t.slice(0, p);
  const after = t.slice(p);
  const pre = before && !/\s$/.test(before) ? " " : "";
  const post = after && !/^[\s.,;:!?)]/.test(after) ? " " : after ? "" : " ";
  return { text: `${before}${pre}@${name}${post}${after}`, cursor: (before + pre + "@" + name + post).length };
}
