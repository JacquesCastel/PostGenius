// Nouvelle application (menu à cinq entrées, avatar « Mon espace », charte Vercéa) : interrupteur APP_V2, lu à chaque requête.
//  - APP_V2=1     : tout le monde
//  - APP_V2=admin : les administrateurs seulement (aperçu avant ouverture)
//  - absent       : ancienne application ; un administrateur peut quand même l'essayer avec ?nouvelle-app=1 (retour : ?nouvelle-app=0)
export const appV2Mode = (env = process.env) => (env?.APP_V2 === "1" ? "on" : env?.APP_V2 === "admin" ? "admin" : "off");

// pref : choix mémorisé par l'administrateur dans son navigateur ("1" essayer, "0" revenir à l'ancienne), null sinon
export function appV2Active({ mode, isAdmin, pref } = {}) {
  if (mode === "on") return true;
  if (!isAdmin) return false;
  if (pref === "0") return false;
  return mode === "admin" || pref === "1";
}
