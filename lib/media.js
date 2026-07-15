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
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const ext = EXT_FROM_MIME[mimeType] ?? "png";
  const fileName = crypto.randomBytes(10).toString("hex") + "." + ext;
  await fs.writeFile(path.join(MEDIA_DIR, fileName), buffer);
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
