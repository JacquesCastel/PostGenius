// Contrôle des chiffres d'un post généré : quels nombres du texte ne figurent dans AUCUNE des informations
// données à la génération (thématique, profil, sources, consignes) ? PUR (navigateur et serveur).
//
// Ce contrôle est INDICATIF : il repère un nombre absent des informations fournies, pas un nombre faux.
// Un nombre signalé n'est pas forcément inventé (l'auteur l'a peut-être vécu) ; un nombre non signalé
// n'est pas forcément exact (il peut figurer dans une source qui se trompe, ou être déformé).
// Un nombre suivi d'une unité (« 11 mois », « 42 % ») n'est connu que si le MÊME nombre figure avec la MÊME unité
// dans les informations fournies : « 11 collaborateurs » ne valide pas « 11 mois ».
// Il ne contrôle ni les noms propres, ni les citations, ni les études citées.

// Nombre : « 42 », « 1 250 000 », « 1.250.000 », « 2,4 ». L'espace ne relie que des groupes de 3 chiffres.
const NUMBER_RE = /\d+(?:(?:[  ]\d{3}(?!\d))|(?:[.,]\d+))*/g;
const UNIT_RE = /^[  ]?(%|[A-Za-zÀ-ÿ€]+)/;
const URL_RE = /https?:\/\/[^\s)»"]+/gi;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

const keyOf = (token) => token.replace(/\D/g, "");
const clean = (text) => String(text ?? "").replace(URL_RE, " ").replace(HASHTAG_RE, " ");
const isYear = (key) => key.length === 4 && /^(19|20)\d\d$/.test(key);

// Unité normalisée : « % » et « pour cent » ensemble, an/ans/année(s), euro(s)/€, pluriel retiré (même règle des deux côtés).
function normUnit(raw) {
  const u = String(raw ?? "").toLowerCase();
  if (!u) return "";
  if (u === "%" || u === "pour") return "%";
  if (/^an(s|n[eé]es?)?$/.test(u)) return "an";
  if (u === "€" || /^euros?$/.test(u)) return "eur";
  return u.replace(/[sx]$/, "");
}
const COUNTED = new Set(["%", "an", "eur", "k€", "m€", "foi", "moi", "jour", "semaine", "client", "projet", "collaborateur", "salarié", "mission", "entreprise", "dirigeant"]);

const unitAfter = (body, end) => normUnit(body.slice(end, end + 16).match(UNIT_RE)?.[1] ?? "");

// Base : clés (suites de chiffres) de tous les nombres des textes fournis, et paires « clé|unité » quand un mot suit le nombre
export function numberBase(texts) {
  const out = new Set();
  for (const t of Array.isArray(texts) ? texts : [texts]) {
    const body = clean(t);
    for (const m of body.matchAll(NUMBER_RE)) {
      const key = keyOf(m[0]);
      out.add(key);
      const unit = unitAfter(body, m.index + m[0].length);
      if (unit) out.add(`${key}|${unit}`);
    }
  }
  return [...out];
}

// Nombres du texte à vérifier : absents de la base, et qui ressemblent à un chiffre avancé comme un fait
// (au moins deux chiffres, ou suivi d'une unité comme « % » ou « clients » ; une année seule est ignorée).
export function figuresToCheck(text, base, max = 6) {
  if (!Array.isArray(base)) return [];
  const known = new Set(base);
  const withPairs = base.some((k) => String(k).includes("|")); // un serveur plus ancien ne renvoie que les clés
  const body = clean(text);
  const out = [];
  for (const m of body.matchAll(NUMBER_RE)) {
    const key = keyOf(m[0]);
    if (isYear(key)) continue;
    const rawUnit = body.slice(m.index + m[0].length, m.index + m[0].length + 16).match(UNIT_RE)?.[1] ?? "";
    const unit = normUnit(rawUnit);
    const counted = COUNTED.has(unit);
    if (key.length < 2 && !counted) continue;
    const isKnown = counted && withPairs ? known.has(`${key}|${unit}`) : known.has(key);
    if (isKnown) continue;
    const shown = (m[0] + (rawUnit ? (rawUnit === "%" ? " %" : " " + rawUnit) : "")).trim();
    if (!out.includes(shown)) out.push(shown);
    if (out.length >= max) break;
  }
  return out;
}
