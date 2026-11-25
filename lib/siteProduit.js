// Pages « Produit » du nouveau site (/produit, /produit/methode, /produit/verification) : fermées (404) tant que SITE_PRODUIT=1 n'est pas posé.
// Raison : elles décrivent le produit. Chaque phrase doit rester vraie le jour de l'ouverture (offres, périmètre du compagnon éditorial) : voir docs/site/fonctionnement-faits-verifies.md.
export const produitOuvert = (env = process.env) => env?.SITE_PRODUIT === "1";
