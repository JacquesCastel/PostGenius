// Informations de la page /a-propos : à renseigner par l'éditeur. Tant qu'un champ manque, la page reste fermée (404), interrupteur posé ou non.
// Rien ici n'est inventé : chaque champ vide est une information que seul l'éditeur peut donner.
export const A_PROPOS = {
  pourquoi: null, // paragraphe « d'où vient l'idée, pour qui, depuis quand » : une histoire vraie, sans chiffre qu'on ne pourrait pas sourcer
  editeur: { raisonSociale: null, formeJuridique: null, villeSiege: null },
  portrait: { prenomNom: null, role: null, presentation: null }, // deux ou trois phrases, à la première personne
  engagementCorrection: null, // ex. « Toute correction est publiée avec sa date, à côté du résultat concerné. » : un engagement à confirmer par l'éditeur
};

const vide = (v) => v == null || String(v).trim() === "";
export function champsManquants(d = A_PROPOS) {
  const m = [];
  if (vide(d.pourquoi)) m.push("pourquoi");
  for (const k of ["raisonSociale", "formeJuridique", "villeSiege"]) if (vide(d.editeur?.[k])) m.push(`editeur.${k}`);
  for (const k of ["prenomNom", "role", "presentation"]) if (vide(d.portrait?.[k])) m.push(`portrait.${k}`);
  if (vide(d.engagementCorrection)) m.push("engagementCorrection");
  return m;
}
