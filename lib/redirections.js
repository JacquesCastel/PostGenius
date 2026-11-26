// Redirections permanentes de l'ancien site vers le nouveau. PUR. Une redirection n'existe que si :
//   1. SITE_REDIRECTIONS=1 (geste volontaire, séparé de l'ouverture des pages) ET
//   2. la page de destination est ouverte (jamais de redirection vers une 404).
// JAMAIS : /privacy-policy et /privacy (adresse déclarée à LinkedIn). Aucune autre adresse n'est redirigée.
export const REDIRECTIONS = {
  "/fonctionnalites": { vers: "/produit", si: "produit" },
  "/comment-ca-marche": { vers: "/produit/methode", si: "produit" },
  "/mentions-legales": { vers: "/legal#mentions", si: "legal" },
  "/cgu": { vers: "/legal#cgu", si: "legal" },
  "/confidentialite": { vers: "/legal#confidentialite", si: "legal" },
};
export const JAMAIS_REDIRIGEES = ["/privacy-policy", "/privacy"];

export function cibleRedirection(chemin, ouvertures, env = process.env) {
  if (env?.SITE_REDIRECTIONS !== "1" || JAMAIS_REDIRIGEES.includes(chemin)) return null;
  const r = REDIRECTIONS[chemin];
  return r && ouvertures?.[r.si] ? r.vers : null;
}
