// Détail lisible d'une réponse d'erreur LinkedIn (corps JSON : message, serviceErrorCode…).
// LinkedIn y nomme souvent la permission ou le produit manquant (« Not enough permissions
// to access: … »), utile pour comprendre un refus sans fouiller les journaux. Ces textes
// ne contiennent aucun secret ; on les tronque pour l'affichage.
export function linkedinErrorDetail(raw) {
  if (!raw) return "";
  let text = "";
  try {
    const j = JSON.parse(raw);
    text = [j.message, j.code ?? j.serviceErrorCode ?? null].filter((v) => v !== null && v !== undefined && v !== "").join(" — ");
  } catch {
    if (/^\s*</.test(String(raw))) return ""; // page HTML (proxy, passerelle) : rien d'exploitable
    text = String(raw);
  }
  text = text.replace(/\s+/g, " ").trim();
  return text.length > 240 ? text.slice(0, 237) + "…" : text;
}

// Ajoute le détail à un message d'erreur, s'il y en a un
export const withDetail = (message, raw) => {
  const d = linkedinErrorDetail(raw);
  return d ? `${message} Détail LinkedIn : ${d}` : message;
};
