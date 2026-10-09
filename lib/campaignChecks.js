// Contrôle d'un texte rédigé pour une publication du plan : applique les règles DU BRIEF (jamais des règles inventées).
// PUR (navigateur et serveur). Deux niveaux : « error » = écart à une règle explicite du brief (régénéré une fois automatiquement) ;
// « warn » = à vérifier (longueur souhaitée, chiffre non fourni, voix, ressemblance entre comptes).

import { norm } from "./campaignBrief";
import { hookSimilarity } from "./postMemoryText";

const URL_RE = /https?:\/\/[^\s)»"]+/gi;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const WORDS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6 };
const urlKey = (u) => String(u ?? "").trim().replace(/[.,;:!?]+$/, "").replace(/\/+$/, "").toLowerCase();

const rulesText = (brief) => (brief?.rules ?? []).join(" \n ");
const bodyOf = (text) => String(text ?? "").replace(URL_RE, "").trim();

// Règle d'emoji : le brief demande zéro emoji (« zéro emoji », « sans emoji », « pas d'emoji »…)
export function noEmojiRule(brief) {
  return /(z[eé]ro|sans|aucun|pas d['’ ]|jamais d['’ ])\s*(d['’])?\s*[eé]mojis?/i.test(norm(rulesText(brief)).replace(/emoji/g, "emoji")) || /(zero|sans|aucun|pas d'|jamais d')\s*emojis?/i.test(norm(rulesText(brief)));
}

// Nombre maximal de hashtags demandé par le brief (null si le brief n'en parle pas)
export function maxHashtags(brief) {
  const t = norm(rulesText(brief));
  if (!/hashtag/.test(t)) return null;
  const seg = t.split(/[.;\n]/).find((s) => /hashtag/.test(s)) ?? t;
  const nums = [...seg.matchAll(/\b(\d+|un|une|deux|trois|quatre|cinq|six)\b/g)].map((m) => (/\d/.test(m[1]) ? Number(m[1]) : WORDS[m[1]]));
  if (/zero|sans|aucun|pas de/.test(seg) && !nums.length) return 0;
  return nums.length ? Math.max(...nums) : 3;
}

// Mots ou expressions courts interdits par le brief (les interdits longs, des phrases, ne se contrôlent pas mot à mot)
export function bannedTerms(brief) {
  return (brief?.forbidden ?? []).map((f) => String(f).trim()).filter((f) => f.length >= 3 && f.length <= 40 && f.split(/\s+/).length <= 4 && !/^(aucun|aucune|pas de|ne |n['’])/i.test(f));
}
const hasTerm = (hayNorm, term) => new RegExp(`(^|[^a-z0-9])${norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hayNorm);

const sentences = (t) => new Set(String(t ?? "").split(/(?<=[.!?…])\s+|\n+/).map((s) => norm(s).replace(/[^a-z0-9 ]/g, "").trim()).filter((s) => s.length > 25));
export function similarity(a, b) {
  const A = sentences(a), B = sentences(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const s of A) if (B.has(s)) common++;
  return common / Math.min(A.size, B.size);
}

// item : ligne du plan ; account : compte du brief { kind, lengthMin, lengthMax } ; others : textes des autres comptes [{ref, account, text}]
export function checkPost({ text, item, brief, account = null, others = [], previous = [] }) {
  const issues = [];
  const add = (code, severity, msg) => issues.push({ code, severity, text: msg });
  const t = String(text ?? "");
  if (!t.trim()) return issues;
  const body = bodyOf(t);

  if (noEmojiRule(brief)) {
    const n = (body.match(EMOJI_RE) ?? []).length;
    if (n) add("emoji", "error", `${n} emoji alors que le brief demande zéro emoji.`);
  }
  const maxTags = maxHashtags(brief);
  if (maxTags !== null) {
    const n = (body.match(HASHTAG_RE) ?? []).length;
    if (n > maxTags) add("hashtags", "error", `${n} hashtags alors que le brief en autorise ${maxTags} au maximum.`);
  }
  const hay = ` ${norm(body)} `;
  const hit = bannedTerms(brief).filter((w) => hasTerm(hay, w));
  if (hit.length) add("forbidden", "error", `Terme interdit par le brief : ${hit.map((h) => `« ${h} »`).join(", ")}.`);
  if (/commentez\s+["«“]?\s*oui/i.test(body)) add("bait", "error", "Appel à commenter « OUI » : proscrit par le brief.");

  // Liens : exactement celui de la ligne, ou aucun
  const urls = [...new Set((t.match(URL_RE) ?? []).map(urlKey))];
  if (item.url) {
    if (!urls.includes(urlKey(item.url))) add("link-missing", "error", "Le lien exact de la publication est absent du texte.");
    if (urls.some((u) => u !== urlKey(item.url))) add("link-other", "error", "Le texte contient un autre lien que celui de la publication.");
  } else if (urls.length) add("link-unexpected", "error", "Cette publication est prévue sans lien (question sans lien).");
  if (urls.length > 1) add("link-many", "warn", "Plus d'un lien : le brief demande un seul lien utile.");

  // Longueur souhaitée du compte (préférence éditoriale, pas un seuil)
  if (account?.lengthMin && account?.lengthMax) {
    const n = body.length;
    if (n < account.lengthMin * 0.9 || n > account.lengthMax * 1.1) add("length", "warn", `${n} caractères pour ${account.lengthMin} à ${account.lengthMax} souhaités.`);
  }

  // Chiffres que le brief ne fournit pas : à confirmer
  const known = norm([item.angle, item.objective, item.toConfirm, item.cta, brief?.context, brief?.message, brief?.objective].join(" "));
  const figures = [...body.matchAll(/\b\d[\d\s.,]*\s?(%|pour cent|fois|clients?|projets?|ans|années|collaborateurs|films?|vidéos?|articles?|missions?)/gi)].map((m) => m[0].trim());
  const unknown = [...new Set(figures)].filter((f) => !known.includes(norm(f).split(" ")[0]));
  if (unknown.length) add("figures", "warn", `Chiffre à confirmer (absent du brief) : ${unknown.slice(0, 3).join(", ")}.`);

  // Voix : la page parle au nom de l'agence (« nous »), pas à la première personne du singulier
  if (account?.kind === "org" && /(^|[^a-zà-ÿ])(je|mon|ma|mes)(?![a-zà-ÿ])|(^|[^a-zà-ÿ])j['’]/i.test(body)) add("voice", "warn", "Première personne du singulier sur une page : la voix de l'agence est « nous » ou « Wharf ».");

  // Deux comptes ne publient jamais le même texte
  for (const o of others) {
    if (similarity(body, bodyOf(o.text)) >= 0.5) add("similar", "warn", `Très proche du texte de ${o.ref} (${o.account}) : les comptes ne publient pas le même texte.`);
  }
  // Continuité : pas deux accroches identiques sur un même compte
  for (const p of previous) {
    if (hookSimilarity(body, bodyOf(p.text)) >= 0.7) add("hook", "warn", `Accroche très proche de celle de ${p.ref} : variez l'ouverture.`);
  }
  return issues;
}

export const verdict = (issues) => (issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warn" : "ok");
export const errorCount = (issues) => issues.filter((i) => i.severity === "error").length;

// Corrections SÛRES et automatiques des règles de forme du brief : emoji retirés si le brief demande zéro emoji ;
// hashtags au-delà du maximum retirés (en partant de la fin). Les autres écarts (termes interdits, liens) ne se corrigent pas mécaniquement.
export function autoFix(text, brief) {
  let t = String(text ?? "");
  const fixes = [];
  if (noEmojiRule(brief)) {
    const n = (t.match(EMOJI_RE) ?? []).length;
    if (n) {
      t = t.replace(EMOJI_RE, "").replace(/[\u200d\ufe0f]/g, "").replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").replace(/ +([.,;:!?])/g, "$1");
      fixes.push(`${n} emoji retiré${n > 1 ? "s" : ""}`);
    }
  }
  const max = maxHashtags(brief);
  if (max !== null) {
    const tags = [...t.matchAll(HASHTAG_RE)];
    if (tags.length > max) {
      let drop = tags.length - max;
      const parts = [...tags].reverse();
      for (const m of parts) {
        if (drop <= 0) break;
        const start = m.index + m[1].length;
        t = t.slice(0, m.index) + m[1] + t.slice(start + m[0].length - m[1].length);
        drop--;
      }
      t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
      fixes.push(`hashtags ramenés à ${max}`);
    }
  }
  return { text: t.trim(), fixes };
}
