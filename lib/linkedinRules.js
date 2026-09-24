// Règles d'écriture LinkedIn — source unique partagée par le générateur de posts
// (prompts) et le score d'engagement (heuristique), pour qu'un post généré respecte
// par construction les critères sur lesquels il sera ensuite noté.
// PUR : utilisable côté client comme côté serveur.
//
// Principe éditorial : PYRAMIDE INVERSÉE (l'essentiel d'abord, les détails ensuite,
// le secondaire en dernier), pas une formule imposée. Seules restent obligatoires les
// contraintes réellement propres à LinkedIn (le « voir plus », le risque de spam) ;
// le reste (tension de l'accroche, question finale, CTA, hashtags, emoji) est une
// option que le texte peut saisir s'il s'y prête, jamais une case à cocher.

export const RULES = {
  hookMax: 90, // 1re ligne : seule visible avant « voir plus »
  hookSoftMax: 140,
  lengthMin: 400,
  lengthMax: 1600,
  lengthSoftMin: 200,
  lengthSoftMax: 2200,
  hashtagsMax: 5, // au-delà, ça fait spam — pas de minimum imposé
  emojisMax: 6, // zéro est tout aussi valable
};

// Tension d'une accroche : question, chiffre, ou promesse introduite par « : ».
// Signal bonus pour le score, plus une exigence du générateur.
export const TENSION_REGEX = /\?|\d|:/;

// Appel à l'action reconnu par le score, et exemples cités au générateur
export const CTA_REGEX = /(commentez|partagez|votre avis|qu'en pensez|t[ée]l[ée]chargez|inscrivez|contactez|r[ée]servez|d[ée]couvrez|en savoir plus|lien en commentaire|dites-moi|r[ée]agissez)/i;
export const CTA_EXAMPLES = ["« Dites-moi en commentaire… »", "« Partagez votre avis »", "« Qu'en pensez-vous ? »"];

// Garde anti-invention : l'IA ne connaît pas les vrais clients, études ou chiffres de
// l'auteur. Sans ce garde-fou, un thème comme « les résultats de notre étude » la pousse
// à inventer des statistiques présentées comme réelles. Les chiffres/noms que l'auteur a
// lui-même donnés (thématique, profil, brief) restent utilisables tels quels.
export const ANTI_INVENTION_INSTRUCTION = `N'invente jamais de nom, de chiffre, de statistique ou de fait présenté comme réel que tu ne connais pas : tu n'as pas accès aux vraies données, études ou clients de l'auteur. Si la demande n'en fournit pas, formule l'idée en termes généraux (« une part importante des… », « beaucoup de… ») ou comme un cas type clairement présenté comme tel (ex. « Prenons l'exemple d'un consultant qui… »), jamais comme un fait précis et vérifiable. Tu peux en revanche reprendre tel quel un chiffre, un nom ou un fait que la thématique, le profil ou le brief t'ont explicitement donné.`;

// Bloc de règles injecté dans les prompts de génération.
// La longueur visée respecte toujours la longueur maximale choisie par l'utilisateur.
export function writingRulesPrompt(maxChars) {
  const upper = Math.min(RULES.lengthMax, Number(maxChars) || RULES.lengthMax);
  const lower = Math.min(RULES.lengthMin, upper);
  const length =
    upper > lower
      ? `environ ${lower} à ${upper} caractères, sans remplir pour atteindre un chiffre`
      : `${upper} caractères au maximum`;
  return `Règles d'écriture LinkedIn — structure le post en PYRAMIDE INVERSÉE : l'idée essentielle d'abord, le développement ensuite, le secondaire à la fin. Pas de formule plaquée : chaque post doit avoir l'air écrit pour SON sujet, pas rempli à partir d'un moule.
- ACCROCHE (1re ligne, ${RULES.hookMax} caractères maximum — c'est la SEULE ligne visible avant « voir plus ») : elle doit porter à elle seule l'idée centrale du post, pas juste l'annoncer. Un lecteur qui ne lit qu'elle doit déjà avoir compris le message. Une question, un chiffre ou un « : » peuvent l'aider à percuter, mais seulement si ça sert le sens — pas une clause obligatoire.
- CORPS : développe cette idée (le pourquoi, une preuve, un exemple concret) puis termine par ce qui compte le moins pour la comprendre. Phrases courtes, un paragraphe = une idée, une ligne vide entre les paragraphes.
- LONGUEUR : ${length}.
- FIN : si une question ou un appel à l'action viennent naturellement, très bien ; sinon le post peut se conclure sur sa propre idée, sans formule ajoutée pour la forme.
- ÉMOJIS : ${RULES.emojisMax} maximum, seulement s'ils servent la lecture. Zéro émoji est un choix tout aussi valable.
- HASHTAGS : ${RULES.hashtagsMax} maximum si pertinents, tout à la fin. Aucun n'est requis.

${ANTI_INVENTION_INSTRUCTION}`;
}

// --- Explication de la forme du post ("Pourquoi ce post ?") ---

export const WHY_KEYS = ["hook", "structure", "cta", "hashtags"];

export const WHY_JSON_FORMAT = `"why": {"hook": "...", "structure": "...", "cta": "...", "hashtags": "..."}`;

export const WHY_INSTRUCTION = `Le champ "why" explique tes choix d'écriture pour CE post : une phrase courte (25 mots maximum) par clé, concrète (elle décrit ce que fait réellement le post), sans généralités.
- hook : pourquoi cette première ligne porte à elle seule l'idée du post.
- structure : pourquoi cet enchaînement (l'essentiel d'abord, les détails ensuite).
- cta : pourquoi cette fin (question, appel à l'action, ou simple conclusion si tu n'en as pas forcé une).
- hashtags : pourquoi ces hashtags, ou pourquoi tu n'en as pas mis.
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
