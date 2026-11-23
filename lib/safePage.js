import { safeGet, SafeFetchError } from "./safeFetch";
import { htmlToText, cleanText } from "./knowledgeText";

// Lecture d'une page web publique → { title, text } : même comportement et mêmes messages que lib/knowledge.js::fetchPageText, mais le téléchargement passe par
// lib/safeFetch.js (adresses internes refusées au moment de la connexion, redirections contrôlées une à une, taille et délai limités).
// lib/knowledge.js (fichier gelé de la démonstration) n'est pas modifié : les appels qui reçoivent une adresse d'un utilisateur utilisent cette fonction.

const MAX_DOWNLOAD = 2_000_000; // 2 Mo de HTML au plus
const FETCH_TIMEOUT = 12_000;

export async function fetchPageTextSafe(url) {
  let res;
  try {
    res = await safeGet(url, { maxBytes: MAX_DOWNLOAD, timeoutMs: FETCH_TIMEOUT, headers: { "User-Agent": "LinkeePost/1.0 (base de connaissances)", Accept: "text/html, text/plain;q=0.8" } });
  } catch (e) {
    if (e instanceof SafeFetchError && (e.code === "blocked" || e.code === "invalid")) throw new Error("Adresse invalide ou non autorisée.");
    throw new Error("Impossible de joindre cette adresse.");
  }
  if (!res.ok) throw new Error(`Cette page répond une erreur (${res.status}).`);
  const type = String(res.headers["content-type"] ?? "");
  if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
    throw new Error("Seules les pages web et les textes sont lus ici (pour un PDF ou un document Word, utilisez l'import de fichier).");
  }
  const raw = res.body.toString("utf8");
  const { title, text } = /text\/plain/i.test(type) ? { title: "", text: cleanText(raw) } : htmlToText(raw);
  if (text.length < 200) throw new Error("Cette page ne contient pas assez de texte lisible (contenu affiché par JavaScript, ou page protégée).");
  return { title, text };
}
