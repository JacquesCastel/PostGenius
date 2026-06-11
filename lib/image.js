import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Stockage des images générées : ./data/images (monté en volume Docker en prod)

export const IMAGE_DIR = process.env.IMAGE_DIR || path.join(process.cwd(), "data", "images");

const SAFE_NAME = /^[a-f0-9]{16}\.png$/;

export function imagePath(fileName) {
  if (!SAFE_NAME.test(fileName)) throw new Error("Nom de fichier invalide.");
  return path.join(IMAGE_DIR, fileName);
}

export async function saveImage(b64) {
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const fileName = crypto.randomBytes(8).toString("hex") + ".png";
  await fs.writeFile(path.join(IMAGE_DIR, fileName), Buffer.from(b64, "base64"));
  return { fileName, url: `/api/images/${fileName}` };
}

export async function readImageFromUrl(imageUrl) {
  const fileName = (imageUrl ?? "").split("/").pop();
  return fs.readFile(imagePath(fileName));
}
