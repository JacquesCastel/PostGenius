// Langue de génération des posts. Le français est la langue de l'interface et des consignes ;
// pour les autres langues, une consigne impérative est ajoutée aux prompts de rédaction
// (génération, campagnes, pilote automatique, événements). PUR : navigateur et serveur.

export const LANGUAGES = [
  { code: "fr", label: "Français", name: "français" },
  { code: "en", label: "English", name: "anglais" },
  { code: "es", label: "Español", name: "espagnol" },
  { code: "de", label: "Deutsch", name: "allemand" },
  { code: "it", label: "Italiano", name: "italien" },
  { code: "pt", label: "Português", name: "portugais" },
  { code: "nl", label: "Nederlands", name: "néerlandais" },
];
export const DEFAULT_LANGUAGE = "fr";

export const isLanguage = (code) => LANGUAGES.some((l) => l.code === code);
export const normalizeLanguage = (code) => (isLanguage(code) ? code : DEFAULT_LANGUAGE);
export const languageName = (code) => LANGUAGES.find((l) => l.code === normalizeLanguage(code)).name;
export const languageLabel = (code) => LANGUAGES.find((l) => l.code === normalizeLanguage(code)).label;

// Consigne ajoutée aux prompts de rédaction ; vide pour le français (comportement historique).
export function languageInstruction(code) {
  const lang = normalizeLanguage(code);
  if (lang === DEFAULT_LANGUAGE) return "";
  return `

LANGUE DE RÉDACTION (IMPÉRATIF) : rédige l'intégralité du post (accroche, corps, appel à l'action, hashtags) en ${languageName(lang)}, même si ces consignes, la thématique ou le profil sont en français. Adapte les tournures et les références à cette langue au lieu de traduire mot à mot. Les clés du JSON restent inchangées ; le champ « why » et les titres de série (« Post 1 — Teaser ») restent rédigés en français.`;
}

// Le prompt système présente l'expert comme « francophone » : on l'ajuste hors français
export function systemPromptFor(base, code) {
  const lang = normalizeLanguage(code);
  return lang === DEFAULT_LANGUAGE ? base : base.replace("francophone", `en ${languageName(lang)}`);
}
