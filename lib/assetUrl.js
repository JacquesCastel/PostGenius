// Images d'un gabarit visuel (logo, fond, images d'un modèle personnalisé) : le moteur de rendu (Satori) télécharge toute adresse http(s) qu'on lui donne.
// Une adresse saisie par un client ne doit donc jamais lui parvenir telle quelle (le serveur irait la lire, y compris une adresse interne).
// Sont acceptés : les images de Vercéa (chemin /api/images/…, ou adresse complète de NOTRE site) et les images intégrées (data:image/…).
// Tout le reste est retiré : le gabarit s'affiche sans cette image, comme si elle n'existait pas. PUR : aucun accès réseau.

const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

export function isOwnAsset(src, appUrl = process.env.APP_URL || "http://localhost:3000") {
  if (typeof src !== "string" || !src) return false;
  if (DATA_IMAGE.test(src)) return true;
  if (src.startsWith("//")) return false;
  if (src.startsWith("/")) return /^\/api\/images\/[A-Za-z0-9._\/-]+$/.test(src) && !src.includes("..");
  try {
    const u = new URL(src), own = new URL(appUrl);
    return u.origin === own.origin && /^\/api\/images\/[A-Za-z0-9._\/-]+$/.test(u.pathname) && !u.pathname.includes("..");
  } catch { return false; }
}

// Charte graphique sans les images qui ne sont pas de chez nous
export function guardKitAssets(kit, appUrl) {
  if (!kit) return kit;
  return { ...kit, logoUrl: isOwnAsset(kit.logoUrl, appUrl) ? kit.logoUrl : null, backgroundUrl: isOwnAsset(kit.backgroundUrl, appUrl) ? kit.backgroundUrl : null };
}

// Modèle personnalisé (éléments de l'éditeur visuel) : les images externes sont retirées
export function guardTemplate(template, appUrl) {
  if (!template || !Array.isArray(template.elements)) return template;
  return { ...template, elements: template.elements.map((el) => (el?.type === "image" && el.role !== "logo" && !isOwnAsset(el.src, appUrl) ? { ...el, src: null } : el)) };
}
