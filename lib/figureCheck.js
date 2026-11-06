// Contrôle des chiffres d'un post généré : quels nombres du texte ne figurent dans AUCUNE des informations
// données à la génération (thématique, profil, sources, consignes) ? PUR (navigateur et serveur).
//
// Ce contrôle est INDICATIF : il repère un nombre absent des informations fournies, pas un nombre faux.
// Un nombre signalé n'est pas forcément inventé (l'auteur l'a peut-être vécu) ; un nombre non signalé
// n'est pas forcément exact (il peut figurer dans une source qui se trompe, ou être déformé : « 12 » pour « 21 »
// serait signalé, « 21 » pour « 12 » ne le serait pas si 21 apparaît ailleurs dans les sources).
// Il ne contrôle ni les noms propres, ni les citations, ni les études citées.

// Nombre : « 42 », « 1 250 000 », « 1.250.000 », « 2,4 ». L'espace ne relie que des groupes de 3 chiffres.
const NUMBER_RE = /\d+(?:(?:[  ]\d{3}(?!\d))|(?:[.,]\d+))*/g;
const UNIT_RE = /^[  ]?(%|[A-Za-zÀ-ÿ€]+)/;
const URL_RE = /https?:\/\/[^\s)»"]+/gi;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

const keyOf = (token) => token.replace(/\D/g, "");
const clean = (text) => String(text ?? "").replace(URL_RE, " ").replace(HASHTAG_RE, " ");
const isYear = (key) => key.length === 4 && /^(19|20)\d\d$/.test(key);

// Clés (suites de chiffres) de tous les nombres des textes fournis à la génération
export function numberBase(texts) {
  const keys = new Set();
  for (const t of Array.isArray(texts) ? texts : [texts]) {
    for (const m of clean(t).matchAll(NUMBER_RE)) keys.add(keyOf(m[0]));
  }
  return [...keys];
}

// Nombres du texte à vérifier : absents de la base, et qui ressemblent à un chiffre avancé comme un fait
// (au moins deux chiffres, ou suivi d'une unité comme « % » ou « clients » ; une année seule est ignorée).
export function figuresToCheck(text, base, max = 6) {
  if (!Array.isArray(base)) return [];
  const known = new Set(base);
  const body = clean(text);
  const out = [];
  for (const m of body.matchAll(NUMBER_RE)) {
    const key = keyOf(m[0]);
    if (known.has(key) || isYear(key)) continue;
    const unit = body.slice(m.index + m[0].length, m.index + m[0].length + 16).match(UNIT_RE)?.[1] ?? "";
    const hasUnit = unit === "%" || /^(pour|fois|clients?|projets?|ans?|ann[eé]es?|mois|jours?|semaines?|collaborateurs?|salari[eé]s?|missions?|entreprises?|dirigeants?|euros?|€|k€|m€)$/i.test(unit);
    if (key.length < 2 && !hasUnit) continue;
    const shown = (m[0] + (unit ? (unit === "%" ? " %" : " " + unit) : "")).trim();
    if (!out.includes(shown)) out.push(shown);
    if (out.length >= max) break;
  }
  return out;
}
