// Retouche conversationnelle d'un post : à chaque consigne, le modèle répond en une phrase ce qu'il a changé
// et peut proposer des « À retenir » (préférences durables, jamais appliquées sans accord de l'auteur).
// Le client accepte → PostRemark → injecté dans les prochaines générations.

export const MAX_REMEMBER = 2;
export const REMEMBER_CHARS = 140;
export const REPLY_CHARS = 200;
export const MAX_HISTORY = 6;

const norm = (t) => String(t ?? "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const clip = (t, n) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

// Consignes déjà demandées sur ce post (les plus récentes), pour repérer ce qui revient
export function cleanHistory(h) {
  return (Array.isArray(h) ? h : []).filter((t) => typeof t === "string" && t.trim()).map((t) => clip(t, 200)).slice(-MAX_HISTORY);
}

export function historyBlock(history) {
  const h = cleanHistory(history);
  if (!h.length) return "";
  return `\nConsignes déjà demandées sur ce post, avant celle-ci :\n${h.map((t) => `- ${t}`).join("\n")}`;
}

export const REFINE_CHAT_JSON = `"reply": "une phrase qui dit ce que tu as changé (${REPLY_CHARS} caractères max)", "remember": []`;

export const REFINE_CHAT_INSTRUCTION = `Le champ "reply" dit en une phrase, à la première personne, ce que tu as changé dans le post.
Le champ "remember" contient 0 à ${MAX_REMEMBER} consignes durables sur la façon d'écrire de l'auteur, à l'impératif, ${REMEMBER_CHARS} caractères maximum (ex : « Ne pas utiliser d'émojis », « Terminer par une question »). Ajoute-en UNIQUEMENT si la consigne exprime une préférence générale de style, ou si la même demande revient dans les consignes précédentes. Jamais pour une demande propre à ce sujet, ni pour un simple « plus court » isolé. Ne reformule jamais une remarque déjà enregistrée. Dans le doute, laisse la liste vide.`;

// Sortie du modèle → { reply, remember } bornés ; remember exclut les remarques déjà enregistrées
export function cleanRefineChat(o, existingRemarks = []) {
  const known = new Set(existingRemarks.map((r) => norm(typeof r === "string" ? r : r?.text)));
  const seen = new Set();
  const remember = [];
  for (const t of Array.isArray(o?.remember) ? o.remember : []) {
    const text = clip(t, REMEMBER_CHARS);
    const k = norm(text);
    if (text.length < 8 || known.has(k) || seen.has(k)) continue;
    seen.add(k);
    remember.push(text);
    if (remember.length >= MAX_REMEMBER) break;
  }
  return { reply: clip(o?.reply, REPLY_CHARS), remember };
}
