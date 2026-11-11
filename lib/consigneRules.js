// Contrôle des consignes d'un post libre. PUR (navigateur et serveur), aucune dépendance : testable seul.
//
// Principe : on ne contrôle QUE ce qui est écrit noir sur blanc dans les consignes de l'utilisateur (consignes de style, ligne éditoriale,
// remarques, mots « à éviter », longueur maximale du formulaire). Aucune règle n'est inventée : une consigne ambiguë ou conditionnelle
// (« tutoiement seulement sur les posts personnels », « 3 hashtags ») ne produit AUCUNE règle plutôt qu'une règle devinée.
// Le contrôle ne modifie jamais le texte : il montre un écart, l'utilisateur décide.
// Les règles sont calculées côté serveur (qui connaît les consignes) et renvoyées avec le post ; le navigateur applique `checkConsignes`
// au texte affiché, comme pour « Chiffres à vérifier ».

// Ce qui est contrôlé, et ce qui ne l'est pas : affiché à côté du résultat
export const CONSIGNES_CHECKED = "Contrôlé : zéro émoji, nombre maximal de hashtags, mots à éviter, longueur maximale, tutoiement ou vouvoiement. Les autres consignes sont transmises à l'IA, sans contrôle ensuite.";

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘]/g, "'");
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const URL_RE = /https?:\/\/[^\s)»"]+/gi;
const WORDS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
const NUM = "(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)";
const toNumber = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS[s]);
const segments = (text) => norm(text).split(/[.;\n!?]+/).map((s) => s.trim()).filter(Boolean);
const CONDITIONAL = /\b(sauf|seulement|uniquement|quand|lorsque|selon|si)\b/;
// Négation placée AVANT le mot (« pas de tutoiement », « évite le vouvoiement », « ne tutoie pas ») ; « sans exception » après le mot n'inverse rien
const negated = (seg, stem) => new RegExp(`(?:pas de|pas d'|jamais|sans|evit\\w*|interdi\\w*|proscri\\w*|aucun)\\s+(?:\\w+\\s+){0,2}(?:${stem})\\w*|\\bne\\s+(?:\\w+\\s+)?(?:${stem})\\w*\\s+pas`).test(seg);

const REQUIRE_EMOJI_ZERO = /(?:\bzero|\b0|\bsans|\baucun|\bpas d'|\bpas de |\bjamais d'|\bjamais de )\s*emojis?/;
const HASHTAG_ZERO = /(?:\bzero|\b0|\bsans|\baucun|\bpas d'|\bpas de |\bjamais de )\s*hashtags?/;
const HASHTAG_MAX = [
  new RegExp(`(?:\\bmax(?:imum)?(?: de)?|pas plus de|pas plus d'|au plus|jusqu'a|limite[a-z]* a)\\s*${NUM}\\s*hashtags?`),
  new RegExp(`${NUM}\\s*hashtags?\\s*(?:maximum|max\\b)`),
];

// Règles contrôlables dérivées des consignes. Renvoie [{ id, kind, origin, value?, terms?, side? }] (JSON simple, envoyé au navigateur).
//   sources : [{ origin, text }] consignes libres (style, ligne éditoriale, remarques)
//   avoid : mots ou expressions « à éviter » validés par l'utilisateur (éléments de langage)
//   maxChars : longueur maximale du formulaire (nombre) ; language : langue du post ("fr", …) : le tutoiement ne se contrôle qu'en français
export function deriveConsigneRules({ sources = [], avoid = [], maxChars = null, language = "fr" } = {}) {
  const rules = [];
  let noEmoji = null;
  let hashtagMax = null; // { value, origin }
  const address = new Set();
  let addressOrigin = "";

  for (const src of sources) {
    const origin = String(src?.origin ?? "Consignes");
    for (const seg of segments(src?.text)) {
      if (REQUIRE_EMOJI_ZERO.test(seg) && !CONDITIONAL.test(seg)) noEmoji ??= origin;
      if (/hashtag/.test(seg) && !CONDITIONAL.test(seg)) {
        let value = null;
        if (HASHTAG_ZERO.test(seg)) value = 0;
        else {
          for (const re of HASHTAG_MAX) {
            const m = seg.match(re);
            if (m) { value = toNumber(m[1]); break; }
          }
        }
        if (value != null && (hashtagMax == null || value < hashtagMax.value)) hashtagMax = { value, origin };
      }
      const tut = /tutoi|tutoy/.test(seg), vouv = /vouvoi|vouvoy/.test(seg);
      if ((tut || vouv) && !CONDITIONAL.test(seg) && !(tut && vouv)) {
        const wants = vouv ? (negated(seg, "vouvoi|vouvoy") ? "tu" : "vous") : negated(seg, "tutoi|tutoy") ? "vous" : "tu";
        address.add(wants);
        addressOrigin ||= origin;
      }
    }
  }
  if (noEmoji) rules.push({ id: "emoji", kind: "noEmoji", origin: noEmoji });
  if (hashtagMax) rules.push({ id: "hashtags", kind: "maxHashtags", value: hashtagMax.value, origin: hashtagMax.origin });
  const terms = [...new Set((Array.isArray(avoid) ? avoid : []).map((t) => String(t ?? "").trim()).filter((t) => t.length >= 3 && t.length <= 60 && t.split(/\s+/).length <= 5))];
  if (terms.length) rules.push({ id: "avoid", kind: "avoidTerms", terms, origin: "Mots à éviter" });
  const max = Number(maxChars);
  if (Number.isFinite(max) && max > 0) rules.push({ id: "length", kind: "maxChars", value: Math.round(max), origin: "Longueur maximale" });
  if (String(language ?? "fr").toLowerCase().startsWith("fr") && address.size === 1) {
    rules.push({ id: "address", kind: "address", side: [...address][0], origin: addressOrigin });
  }
  return rules;
}

const hasTerm = (hay, term) => new RegExp(`(^|[^a-z0-9])${norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|x)?([^a-z0-9]|$)`).test(hay);

// Écarts d'un texte aux règles : [{ id, severity: "error" | "warn", text }]. « error » = écart à une règle mesurable ; « warn » = à vérifier.
export function checkConsignes(text, rules) {
  const t = String(text ?? "");
  if (!t.trim() || !Array.isArray(rules) || !rules.length) return [];
  const body = t.replace(URL_RE, " ");
  const hay = ` ${norm(body)} `;
  const issues = [];
  for (const r of rules) {
    if (r.kind === "noEmoji") {
      const n = (body.match(EMOJI_RE) ?? []).length;
      if (n) issues.push({ id: r.id, severity: "error", text: `${n} émoji${n > 1 ? "s" : ""} alors que vos consignes demandent zéro émoji (${r.origin}).` });
    } else if (r.kind === "maxHashtags") {
      const n = (body.match(HASHTAG_RE) ?? []).length;
      if (n > r.value) issues.push({ id: r.id, severity: "error", text: r.value === 0 ? `${n} hashtag${n > 1 ? "s" : ""} alors que vos consignes demandent aucun hashtag (${r.origin}).` : `${n} hashtags alors que vos consignes en limitent le nombre à ${r.value} (${r.origin}).` });
    } else if (r.kind === "avoidTerms") {
      const hit = (r.terms ?? []).filter((w) => hasTerm(hay, w));
      if (hit.length) issues.push({ id: r.id, severity: "error", text: `Mot à éviter présent : ${hit.map((h) => `« ${h} »`).join(", ")}.` });
    } else if (r.kind === "maxChars") {
      const n = t.trim().length;
      if (n > r.value) issues.push({ id: r.id, severity: "error", text: `${n} caractères pour une longueur maximale de ${r.value}.` });
    } else if (r.kind === "address") {
      const re = r.side === "vous" ? /(^|[^a-z0-9'])(?:(tu|toi|tes|ta)(?![a-z0-9])|(t')(?=[a-z]))/ : /(^|[^a-z0-9'])(vous|votre|vos)(?![a-z0-9])/;
      const found = hay.match(re);
      const token = found ? (found[2] ?? found[3]) : null;
      if (token) issues.push({ id: r.id, severity: "warn", text: `Vos consignes demandent le ${r.side === "vous" ? "vouvoiement" : "tutoiement"} (${r.origin}), mais le texte contient « ${token} ». À vérifier : une citation ou un dialogue est normal.` });
    }
  }
  return issues;
}
