// Conseiller éditorial : interrupteur de développement. Désactivé par défaut : sans EDITORIAL_ADVISOR=1, les routes répondent 404
// et l'interface ne montre rien (comportement existant inchangé).
export const advisorEnabled = (env = process.env) => env?.EDITORIAL_ADVISOR === "1";
