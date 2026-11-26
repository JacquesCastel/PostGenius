// Informations de la page /a-propos : à renseigner par l'éditeur. Tant qu'un champ obligatoire manque (« pourquoi », éditeur), ou qu'un portrait est à moitié rempli, la page reste fermée (404), interrupteur posé ou non.
// Rien ici n'est inventé : chaque champ vide est une information que seul l'éditeur peut donner.
export const A_PROPOS = {
  pourquoi: "l'idée est simple. elle est venue d'un échange avec une amie qui se plaignait de ne jamais avoir assez de temps pour publier et surtout n'avait pas les idées pour savoir sur quoi publier. Prise dans son quotidien de cheffe d'entreprise, elle m'a demandé comment je faisais. ma réponse a été, je suis dans la même cas, je vais nous développer un système performant. L'aventure a démarré", // texte de l'éditeur, repris tel quel (26 novembre 2026)
  editeur: { raisonSociale: "Wharf", formeJuridique: "SARL au capital de 10 000 €", villeSiege: "Paris" }, // donnés par l'éditeur le 26 novembre 2026 (RCS Paris 513 572 883)
  portrait: { prenomNom: null, role: null, presentation: null }, // FACULTATIF : l'éditeur n'en veut pas (26 novembre 2026) ; s'il est rempli, il doit l'être en entier
  engagementCorrection: null, // FACULTATIF : ex. « Toute correction est publiée avec sa date, à côté du résultat concerné. » ; absent = la phrase n'est pas affichée
};

const vide = (v) => v == null || String(v).trim() === "";
export const portraitPresent = (d = A_PROPOS) => ["prenomNom", "role", "presentation"].every((k) => !vide(d.portrait?.[k]));
export function champsManquants(d = A_PROPOS) {
  const m = [];
  if (vide(d.pourquoi)) m.push("pourquoi");
  for (const k of ["raisonSociale", "formeJuridique", "villeSiege"]) if (vide(d.editeur?.[k])) m.push(`editeur.${k}`);
  // portrait facultatif : absent en entier = rien à afficher ; à moitié rempli = oubli probable, la page reste fermée
  const remplis = ["prenomNom", "role", "presentation"].filter((k) => !vide(d.portrait?.[k]));
  if (remplis.length && remplis.length < 3) for (const k of ["prenomNom", "role", "presentation"]) if (vide(d.portrait?.[k])) m.push(`portrait.${k}`);
  return m;
}
