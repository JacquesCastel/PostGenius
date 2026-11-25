// Pages « Preuves » du nouveau site : fermées (404) tant que SITE_PREUVES=1 n'est pas posé sur le serveur.
// Raison : le compte rendu du test E4 contient une liste « À vérifier avant publication » (dépôt public, relecture des formules, clés de test révoquées).
// Fermées par défaut, la fusion et le déploiement du code ne publient rien ; l'ouverture est un geste volontaire, sans nouveau déploiement de code.
export const preuvesOuvertes = (env = process.env) => env?.SITE_PREUVES === "1";
