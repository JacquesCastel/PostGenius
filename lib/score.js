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

  // Accroche (25) — ce qui porte vraiment la pyramide inversée : la 1re ligne doit
  // pouvoir tenir seule. La tension (chiffre, question, « : ») est un bonus, pas une
  // condition : une ligne courte et claire obtient déjà la note "ok".
  let hook = 0;
  if (firstLine.length > 0 && firstLine.length <= RULES.hookMax) hook += 17;
  else if (firstLine.length <= RULES.hookSoftMax) hook += 10;
  if (TENSION_REGEX.test(firstLine)) hook += 8;
  hook = Math.min(25, hook);
  const hookTension = TENSION_REGEX.test(firstLine);
  const hookShort = firstLine.length <= RULES.hookMax;
  let hookAdvice;
  if (hook >= 17) {
    hookAdvice = hookTension
      ? "Votre première ligne tient entière avant le « voir plus » et porte déjà l'idée du post — c'est l'essentiel."
      : "Votre première ligne tient entière avant le « voir plus » — c'est l'essentiel. Une tension (chiffre, question, « : ») peut l'aider à percuter, mais rien d'obligatoire si l'idée est déjà claire.";
  } else if (!firstLine) {
    hookAdvice = "Commencez par une première ligne qui porte à elle seule l'idée du post : c'est elle seule qui s'affiche avant le « voir plus ».";
  } else if (hookShort && !hookTension) {
    hookAdvice = "Votre première ligne est courte, c'est l'essentiel. Vous pouvez y ajouter un chiffre, une question ou un « : » si ça sert le sens, mais ce n'est pas nécessaire.";
  } else {
    hookAdvice = "Raccourcissez la 1re ligne (moins de 90 caractères) pour qu'elle tienne entière avant le « voir plus » : c'est elle qui donne envie de lire la suite.";
  }
  add("Accroche", hook, 25, hook >= 17, hookAdvice);

  // Longueur & aération (25)
  let len = 0;
  if (chars >= RULES.lengthMin && chars <= RULES.lengthMax) len += 15;
  else if (chars >= RULES.lengthSoftMin && chars <= RULES.lengthSoftMax) len += 9;
  if (paragraphs >= 2) len += 10;
  else if (paragraphs >= 1) len += 5;
  len = Math.min(25, len);
  add(
    "Longueur & aération",
    len,
    25,
    len >= 17,
    len >= 17
      ? "Bonne longueur et texte aéré : agréable à lire dans le fil."
      : "Aérez votre texte en courts paragraphes (sauts de ligne) : un post compact décourage la lecture, quelle que soit sa longueur."
  );

  // Question / interaction (10) — un bonus si ça vient naturellement, pas une fin imposée.
  add(
    "Question / interaction",
    hasQuestion ? 10 : 0,
    10,
    hasQuestion,
    hasQuestion
      ? "La question invite à réagir : bon point pour les commentaires."
      : "Si ça vient naturellement, une question ouverte invite aux commentaires — mais un post qui conclut sur sa propre idée fonctionne tout aussi bien."
  );

  // Hashtags (10) — aucun minimum : zéro hashtag est un choix valable.
  let ht = 0;
  if (hashtags <= RULES.hashtagsMax) ht = 10;
  else if (hashtags <= 8) ht = 5;
  add(
    "Hashtags",
    ht,
    10,
    ht >= 10,
    ht >= 10
      ? hashtags === 0
        ? "Pas de hashtag : très bien aussi si le post n'en a pas besoin."
        : "Nombre de hashtags raisonnable."
      : "Réduisez à 5 hashtags vraiment pertinents maximum : au-delà, ça paraît spammy."
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

  // Émojis (10) — zéro émoji obtient la note pleine : ce n'est pas une obligation.
  let em = 0;
  if (emojis <= RULES.emojisMax) em = 10;
  else em = 4;
  add(
    "Émojis",
    em,
    10,
    em >= 10,
    emojis > RULES.emojisMax
      ? "Vous avez beaucoup d'émojis : réduisez à 6 maximum pour rester crédible."
      : emojis === 0
      ? "Aucun émoji : très bien aussi. Vous pouvez en ajouter 1 ou 2 pour rythmer le texte, si vous voulez."
      : "Bon usage des émojis : ils rythment le texte sans l'alourdir."
  );

  // Appel à l'action (10) — bonus si le post en a un, jamais une obligation.
  const cta = CTA_REGEX.test(t);
  add(
    "Appel à l'action",
    cta ? 10 : 0,
    10,
    cta,
    cta
      ? "Un appel à l'action guide votre audience — bon point."
      : "Si ça vient naturellement, un appel à l'action explicite peut aider (« Dites-moi en commentaire… ») — mais un post qui se suffit à lui-même n'en a pas besoin."
  );

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? "Excellent" : score >= 60 ? "Bon" : score >= 40 ? "Moyen" : "À retravailler";
  return { score, level, factors };
}
