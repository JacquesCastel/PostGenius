// Mode d'accès au service, pour tous les textes publics (en-tête, pied de page, pages, boutons).
//  "beta" : bêta fermée. L'accès est sur invitation ; aucune promesse d'essai public ; les boutons mènent à la page /beta.
//  "open" : ouverture publique. Inscription libre avec 14 jours d'essai gratuit, sans carte bancaire.
// Le jour de l'ouverture publique, il suffit de passer cette constante à "open" (et de rouvrir les inscriptions dans Technique → Actions).
export const ACCESS_MODE = "beta";
export const BETA = ACCESS_MODE === "beta";
export const JOIN_HREF = BETA ? "/beta" : "/app";
export const pick = (beta, open) => (BETA ? beta : open);
