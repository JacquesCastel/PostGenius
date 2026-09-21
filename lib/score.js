// Score de potentiel d'engagement d'un post LinkedIn (heuristique, 0-100).
// Basé sur les bonnes pratiques mesurées. PUR : utilisable client comme serveur.
// Ce n'est PAS une prédiction de performance réelle, mais un indicateur de qualité.
// Chaque critère porte un conseil pédagogique (positif si réussi, « vous pouvez… » sinon).
// Les seuils viennent de lib/linkedinRules.js, partagé avec le générateur de posts.

import { RULES, TENSION_REGEX, CTA_REGEX } from "./linkedinRules";

export function scorePost({ text = "", type = "simple" } = {}) {
  const t = (text || "").trim();
  const lines = t.split("\n").filter((l) => l.trim());
  const firstLine = lines[0] || "";
  const chars = t.length;
  const hashtags = (t.match(/#[\p{L}0-9_]+/gu) || []).length;
  const emojis = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
  const hasQuestion = /\?/.test(t);
  const paragraphs = (t.match(/\n\s*\n/g) || []).length;

  const factors = [];
  let score = 0;
  const add = (label, value, max, ok, advice) => {
    score += value;
    factors.push({ label, value, max, ok, advice });
  };

  // Accroche (20)
  let hook = 0;
  if (firstLine.length > 0 && firstLine.length <= RULES.hookMax) hook += 12;
  else if (firstLine.length <= RULES.hookSoftMax) hook += 7;
  if (TENSION_REGEX.test(firstLine)) hook += 8;
  hook = Math.min(20, hook);
  // Le conseil dit précisément ce qui manque : longueur, tension, ou les deux.
  const hookTension = TENSION_REGEX.test(firstLine);
  const hookShort = firstLine.length <= RULES.hookMax;
  let hookAdvice;
  if (hook >= 14) {
    hookAdvice = "Votre première ligne capte l'attention avant le « voir plus » — c'est l'essentiel.";
  } else if (!firstLine) {
    hookAdvice = "Commencez par une première ligne qui capte l'attention : c'est elle seule qui s'affiche avant le « voir plus ».";
  } else if (hookShort && !hookTension) {
    hookAdvice = "Votre première ligne est courte, c'est bien. Il lui manque une tension : une question, un chiffre ou une promesse (avec « : ») donnera plus envie de cliquer sur « voir plus ».";
  } else if (!hookShort && hookTension) {
    hookAdvice = "Votre première ligne a de la tension mais elle est longue : visez moins de 90 caractères pour qu'elle tienne entière avant le « voir plus ».";
  } else {
    hookAdvice = "Raccourcissez la 1re ligne (moins de 90 caractères) et donnez-lui une tension (question, chiffre, promesse) : vous donnerez bien plus envie de cliquer sur « voir plus ».";
  }
  add("Accroche", hook, 20, hook >= 14, hookAdvice);

  // Longueur & aération (20)
  let len = 0;
  if (chars >= RULES.lengthMin && chars <= RULES.lengthMax) len += 12;
  else if (chars >= RULES.lengthSoftMin && chars <= RULES.lengthSoftMax) len += 7;
  if (paragraphs >= 2) len += 8;
  else if (paragraphs >= 1) len += 4;
  len = Math.min(20, len);
  add(
    "Longueur & aération",
    len,
    20,
    len >= 14,
    len >= 14
      ? "Bonne longueur et texte aéré : agréable à lire dans le fil."
      : "Aérez votre texte en courts paragraphes (sauts de ligne) et visez 600 à 1600 caractères : un post compact décourage la lecture."
  );

  // Question / interaction (15)
  add(
    "Question / interaction",
    hasQuestion ? 15 : 0,
    15,
    hasQuestion,
    hasQuestion
      ? "La question invite à réagir : c'est le meilleur levier pour les commentaires."
      : "Terminez par une question ouverte (« Et vous, comment faites-vous ? ») : c'est le levier n°1 pour déclencher des commentaires, que l'algorithme adore."
  );

  // Hashtags (15)
  let ht = 0;
  if (hashtags >= RULES.hashtagsMin && hashtags <= RULES.hashtagsMax) ht = 15;
  else if (hashtags === 1 || (hashtags >= 6 && hashtags <= 8)) ht = 8;
  add(
    "Hashtags",
    ht,
    15,
    ht >= 11,
    ht >= 11
      ? "Nombre de hashtags idéal (2 à 5)."
      : hashtags > 5
      ? "Réduisez à 2-5 hashtags vraiment pertinents : au-delà, ça paraît spammy."
      : "Ajoutez 2 à 5 hashtags pertinents pour être trouvé sur vos thématiques."
  );

  // Format (10) — le texte seul n'est pas pénalisé : ce n'est pas une "erreur" à corriger.
  const fmt = type === "video" ? 8 : 10;
  add(
    "Format",
    fmt,
    10,
    true,
    type === "simple" || !type
      ? "Le texte seul est un format efficace quand il est bien écrit. Un carrousel reste une option si le sujet s'y prête, mais rien d'obligatoire."
      : "Format à fort engagement."
  );

  // Émojis (10)
  let em = 0;
  if (emojis >= 1 && emojis <= RULES.emojisMax) em = 10;
  else if (emojis === 0) em = 5;
  else em = 3;
  add(
    "Émojis",
    em,
    10,
    em >= 7,
    emojis > RULES.emojisMax
      ? "Vous avez beaucoup d'émojis : réduisez à 1-6 pour rester crédible."
      : emojis === 0
      ? "Si vous voulez, ajoutez 1 ou 2 émojis pour rythmer le texte et guider l'œil — sans en abuser."
      : "Bon usage des émojis : ils rythment le texte sans l'alourdir."
  );

  // Appel à l'action (10)
  const cta = CTA_REGEX.test(t);
  add(
    "Appel à l'action",
    cta ? 10 : 0,
    10,
    cta,
    cta
      ? "Un appel à l'action guide votre audience — parfait."
      : "Ajoutez un appel à l'action clair en fin de post (« Dites-moi en commentaire… », « Partagez si ça vous parle »)."
  );

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? "Excellent" : score >= 60 ? "Bon" : score >= 40 ? "Moyen" : "À retravailler";
  return { score, level, factors };
}
