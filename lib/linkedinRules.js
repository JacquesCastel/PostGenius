// Règles d'écriture LinkedIn — source unique partagée par le générateur de posts
// (prompts) et le score d'engagement (heuristique), pour qu'un post généré respecte
// par construction les critères sur lesquels il sera ensuite noté.
// PUR : utilisable côté client comme côté serveur.

export const RULES = {
  hookMax: 90, // 1re ligne : seule visible avant « voir plus »
  hookSoftMax: 130,
  lengthMin: 600,
  lengthMax: 1600,
  lengthSoftMin: 300,
  lengthSoftMax: 2200,
  hashtagsMin: 2, // plage idéale du score
  hashtagsMax: 5,
  hashtagsAskMin: 3, // ce qu'on demande au générateur (dans la plage idéale)
  emojisMax: 6,
};

// Tension d'une accroche : question, chiffre, ou promesse introduite par « : »
export const TENSION_REGEX = /\?|\d|:/;

// Appel à l'action reconnu par le score, et exemples cités au générateur
export const CTA_REGEX = /(commentez|partagez|votre avis|qu'en pensez|t[ée]l[ée]chargez|inscrivez|contactez|r[ée]servez|d[ée]couvrez|en savoir plus|lien en commentaire|dites-moi|r[ée]agissez)/i;
export const CTA_EXAMPLES = ["« Dites-moi en commentaire… »", "« Partagez votre avis »", "« Qu'en pensez-vous ? »"];

// Bloc de règles injecté dans les prompts de génération.
// La longueur visée respecte toujours la longueur maximale choisie par l'utilisateur.
export function writingRulesPrompt(maxChars) {
  const upper = Math.min(RULES.lengthMax, Number(maxChars) || RULES.lengthMax);
  const lower = Math.min(RULES.lengthMin, upper);
  const length =
    upper > lower
      ? `entre ${lower} et ${upper} caractères`
      : `${upper} caractères au maximum`;
  return `Règles d'écriture LinkedIn — à appliquer à ce post :
- ACCROCHE : première ligne de moins de ${RULES.hookMax} caractères qui contient OBLIGATOIREMENT au moins un chiffre, un « ? » ou un « : » (ex : « 3 erreurs qui… », « Pourquoi… ? », « Mon erreur : … »). C'est la seule ligne visible avant « voir plus ».
- STRUCTURE : phrases courtes, un paragraphe = une idée, une ligne vide entre les paragraphes.
- LONGUEUR : ${length}.
- ÉMOJIS : de 1 à ${RULES.emojisMax} au TOTAL dans tout le post, puces comprises (✅, ➡️, 👇 comptent chacune pour un émoji).
- FIN : une question ouverte qui invite à commenter, puis un appel à l'action explicite (ex : ${CTA_EXAMPLES.join(", ")}).
- HASHTAGS : ${RULES.hashtagsAskMin} à ${RULES.hashtagsMax} hashtags pertinents, tout à la fin du post.`;
}

// --- Explication de la forme du post ("Pourquoi ce post ?") ---

export const WHY_KEYS = ["hook", "structure", "cta", "hashtags"];

export const WHY_JSON_FORMAT = `"why": {"hook": "...", "structure": "...", "cta": "...", "hashtags": "..."}`;

export const WHY_INSTRUCTION = `Le champ "why" explique tes choix d'écriture pour CE post : une phrase courte (25 mots maximum) par clé, concrète (elle décrit ce que fait réellement le post), sans généralités.
- hook : pourquoi cette accroche.
- structure : pourquoi cette longueur et cette mise en forme.
- cta : pourquoi cette question finale et cet appel à l'action.
- hashtags : pourquoi ces hashtags.
Ne cite jamais de nombre de caractères, de paragraphes, d'émojis ou de hashtags : ces chiffres sont affichés séparément à côté de ton explication.`;

// Nettoie l'objet "why" renvoyé par le modèle. `forText` mémorise le texte auquel
// l'explication se rapporte, pour détecter qu'elle est périmée après une modification.
export function cleanWhy(why, forText) {
  if (!why || typeof why !== "object") return null;
  const out = {};
  for (const k of WHY_KEYS) {
    if (typeof why[k] === "string" && why[k].trim()) out[k] = why[k].trim().slice(0, 300);
  }
  return Object.keys(out).length ? { ...out, forText } : null;
}

// Éléments réels du post (pas ceux déclarés par le modèle) affichés à côté des explications.
export function postAnatomy(text = "") {
  const t = (text || "").trim();
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const isHashtagLine = (l) => /^(#[\p{L}0-9_]+\s*)+$/u.test(l);
  const hook = lines[0] || "";
  const body = lines.filter((l) => !isHashtagLine(l));
  const closing = body.length > 1 ? body[body.length - 1] : "";
  return {
    hook,
    chars: t.length,
    paragraphs: t ? t.split(/\n\s*\n/).length : 0,
    closing,
    hashtags: t.match(/#[\p{L}0-9_]+/gu) || [],
  };
}
