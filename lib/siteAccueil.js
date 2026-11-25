// Nouvelle page d'accueil (maquette « Accueil ») : l'ancienne reste affichée tant que SITE_ACCUEIL=1 n'est pas posé.
// Raison : l'accueil est la page la plus vue ; son texte change (accroche, structure) et il présente des preuves qui doivent exister.
export const accueilV2Ouvert = (env = process.env) => env?.SITE_ACCUEIL === "1";
