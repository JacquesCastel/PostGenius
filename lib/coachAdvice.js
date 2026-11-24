// Conseil affiché sous un constat du coach. PUR : aucun accès base ni réseau.
// Quand le constat repose sur peu de posts (confiance « faible », moins de 5 posts), le conseil ne doit pas être plus fort que la preuve : c'est une piste à
// tester, pas une injonction, et l'écran ne propose pas d'action directe. Au-delà, les textes sont ceux d'avant, mot pour mot.

export const isTentative = (i) => i?.confidence === "faible";

export function adviceFor(i) {
  if (isTentative(i)) {
    return i.direction === "up"
      ? "À tester sur vos prochains posts : cet écart reste à confirmer."
      : "À surveiller : cet écart reste à confirmer avant d'en tirer une conclusion.";
  }
  if (i.action === "firstcomment") return i.key === "yes" && i.direction === "up" ? "Chez vous, un lien dans le texte ne freine pas la portée." : i.key === "yes" ? "Mettez plutôt le lien en premier commentaire : la portée est meilleure sans lien dans le texte." : i.direction === "up" ? "Gardez le lien pour le premier commentaire." : "Un post sans lien fait moins bien chez vous : testez avec le lien dans le texte.";
  if (i.action === "slot") return i.direction === "up" ? "Programmez vos prochains posts à ce moment." : "Évitez ce moment pour vos posts importants.";
  return i.direction === "up" ? "Écrivez-en davantage." : "À retravailler, ou à espacer.";
}

export const actionLabel = (i) => (i.action === "slot" ? "Voir le planning" : "Créer un post");
