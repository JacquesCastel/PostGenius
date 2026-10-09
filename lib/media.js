import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Stockage des assets médiathèque : ./data/media/ (monté en volume Docker en prod)
export const MEDIA_DIR = process.env.IMAGE_DIR
  ? path.join(path.dirname(process.env.IMAGE_DIR), "media")
  : path.join(process.cwd(), "data", "media");

const EXT_FROM_MIME = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif":  "gif",
};

export function mediaPath(fileName) {
  if (!fileName || fileName.includes("..") || fileName.includes("/")) {
    throw new Error("Nom de fichier invalide.");
  }
  return path.join(MEDIA_DIR, fileName);
}

// Sauvegarde un Buffer (PNG / JPG / WEBP) sur disque et retourne le chemin + URL publique.
export async function saveMediaFile(buffer, mimeType = "image/png") {
  const ext = EXT_FROM_MIME[mimeType] ?? "png";
  const fileName = crypto.randomBytes(10).toString("hex") + "." + ext;
  try {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, fileName), buffer);
  } catch (e) {
    // Le plus fréquent en production : dossier de stockage absent ou sans droit d'écriture pour le conteneur (voir deploy.sh)
    console.error(`[médiathèque] écriture impossible dans ${MEDIA_DIR} :`, e.code ?? "", e.message);
    const err = new Error(e.code === "ENOSPC" ? "Le disque du serveur est plein : l'image n'a pas pu être enregistrée. Contactez le support." : "Le stockage des images est indisponible (dossier non accessible en écriture). Contactez le support.");
    err.code = "STORAGE";
    throw err;
  }
  return { fileName, url: `/api/images/media/${fileName}` };
}

// Supprime le fichier sur disque (silencieux si inexistant).
export async function deleteMediaFile(fileName) {
  try {
    await fs.unlink(path.join(MEDIA_DIR, fileName));
  } catch {
    // Fichier absent — on ignore
  }
}
