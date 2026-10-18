import { parsePostUrn } from "./linkedinPost";

// « Partager vers LinkeePost » : ce que reçoit l'application quand on lui partage un lien (menu Partager du téléphone, favori du navigateur)
// et ce qu'elle en déduit. Fonctions pures : aucune base de données, aucun appel réseau.

export const MAX_SHARE_URL = 2000;
export const MAX_SHARE_TITLE = 300;
export const MAX_SHARE_TEXT = 6000;
export const MIN_NOTE_CHARS = 80; // minimum pour garder un texte dans la base de connaissances
export const MIN_SOURCE_CHARS = 200; // minimum pour écrire un post à partir d'un texte (voir generationSource.js)

const URL_IN_TEXT = /https?:\/\/[^\s<>"')\]]+/i;
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

// Le menu Partager d'Android glisse souvent l'adresse dans le champ « texte » : on la retrouve.
// Renvoie { url, title, text } bornés, sans l'adresse dans le texte.
export function cleanShare({ url, title, text } = {}) {
  let u = clip(url, MAX_SHARE_URL);
  let t = String(text ?? "").replace(/\r\n/g, "\n").trim();
  const found = URL_IN_TEXT.exec(t);
  if (!/^https?:\/\//i.test(u) && found) u = found[0].replace(/[.,;:!?]+$/, "");
  if (found && (found[0] === u || found[0].replace(/[.,;:!?]+$/, "") === u)) t = t.replace(found[0], "").trim();
  if (!/^https?:\/\//i.test(u)) u = "";
  return { url: u, title: clip(title, MAX_SHARE_TITLE), text: t.slice(0, MAX_SHARE_TEXT) };
}

// Nature du lien : linkedin-post (on peut y répondre par son adresse), linkedin (profil, page, lien court…),
// web (page publique lisible par le serveur) ou none
export function shareKind(url) {
  if (!/^https?:\/\//i.test(url ?? "")) return "none";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "none";
  }
  const li = host === "linkedin.com" || host.endsWith(".linkedin.com") || host === "lnkd.in";
  if (!li) return /^(localhost|.*\.local|.*\.internal)$/.test(host) ? "none" : "web";
  return parsePostUrn(url).urn ? "linkedin-post" : "linkedin";
}

// Adresse de la page de partage de l'application (favori du navigateur, cible de partage)
export function shareQuery({ url, title, text }) {
  const p = new URLSearchParams();
  const c = cleanShare({ url, title, text });
  p.set("view", "share");
  if (c.url) p.set("url", c.url);
  if (c.title) p.set("title", c.title);
  if (c.text) p.set("text", c.text);
  return `/app?${p.toString()}`;
}
