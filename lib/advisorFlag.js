// Conseiller éditorial : interrupteur de développement. Désactivé par défaut : sans EDITORIAL_ADVISOR=1, les routes répondent 404
// et l'interface ne montre rien (comportement existant inchangé).
export const advisorEnabled = (env = process.env) => env?.EDITORIAL_ADVISOR === "1";

// Périmètre choisi dans l'Administration (voir lib/advisorAccess.js) :
//   all tous les comptes · accounts seulement les comptes cochés (et les administrateurs) · off personne
export const ADVISOR_MODES = ["all", "accounts", "off"];

export function decideAdvisorAccess({ envOn, mode, userAllowed, isAdmin }) {
  if (!envOn) return false;
  if (mode === "off") return false;
  if (mode === "accounts") return Boolean(userAllowed || isAdmin);
  return true;
}
