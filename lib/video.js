import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Stockage des vidéos de posts : ./data/videos (volume Docker en prod, donc inclus
// dans la sauvegarde). Envoi par morceaux (voir app/api/videos) : un fichier
// <userId>_<rand>.part pendant l'envoi, renommé en .mp4 une fois validé.
// Le nom contient l'id du propriétaire : c'est le contrôle d'accès des routes.

export const VIDEO_DIR = process.env.VIDEO_DIR || path.join(process.cwd(), "data", "videos");
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 Mo
export const MAX_USER_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 Go de vidéos par compte
export const VIDEO_CHUNK = 4 * 1024 * 1024; // taille d'un morceau envoyé par le navigateur

const NAME = /^([a-z0-9]{10,40})_([a-f0-9]{16})\.(mp4|part)$/;

export function parseVideoName(fileName) {
  const m = NAME.exec(fileName ?? "");
  return m ? { userId: m[1], rand: m[2], ext: m[3] } : null;
}

export function videoPath(fileName) {
  if (!parseVideoName(fileName)) throw new Error("Nom de fichier invalide.");
  return path.join(VIDEO_DIR, fileName);
}

export function newVideoName(userId) {
  return `${userId}_${crypto.randomBytes(8).toString("hex")}`;
}

// URL /api/videos/<fichier>.mp4 -> chemin disque, uniquement si elle appartient à userId
export function videoPathFromUrl(videoUrl, userId) {
  const fileName = (videoUrl ?? "").split("/").pop();
  const p = parseVideoName(fileName);
  if (!p || p.ext !== "mp4" || p.userId !== userId) throw new Error("Vidéo introuvable.");
  return path.join(VIDEO_DIR, fileName);
}

export async function userVideoBytes(userId) {
  let total = 0;
  let files = [];
  try {
    files = await fs.readdir(VIDEO_DIR);
  } catch {
    return 0;
  }
  for (const f of files) {
    if (parseVideoName(f)?.userId !== userId) continue;
    try {
      total += (await fs.stat(path.join(VIDEO_DIR, f))).size;
    } catch {}
  }
  return total;
}

// Un MP4/MOV commence par une boîte "ftyp" à l'offset 4
export async function looksLikeVideo(filePath) {
  const fh = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    return buf.toString("latin1", 4, 8) === "ftyp";
  } finally {
    await fh.close();
  }
}

// Entretien (appelé par le planificateur, au plus une fois par heure) :
// - envois interrompus (.part) de plus de 24 h
// - vidéos sans brouillon, de plus de 48 h
// - vidéos de posts publiés depuis plus de 7 jours (le brouillon perd son lien)
export async function cleanupVideos(prisma) {
  let files = [];
  try {
    files = await fs.readdir(VIDEO_DIR);
  } catch {
    return { removed: 0 };
  }
  const now = Date.now();
  const drafts = await prisma.draft.findMany({
    where: { videoUrl: { not: null } },
    select: { id: true, videoUrl: true, status: true, publishedAt: true },
  });
  const byFile = new Map(drafts.map((d) => [d.videoUrl.split("/").pop(), d]));
  let removed = 0;
  for (const f of files) {
    if (!parseVideoName(f)) continue;
    const full = path.join(VIDEO_DIR, f);
    let st;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    const age = now - st.mtimeMs;
    const draft = byFile.get(f);
    let drop = false;
    if (f.endsWith(".part")) drop = age > 24 * 3600e3;
    else if (!draft) drop = age > 48 * 3600e3;
    else if (draft.status === "publié" && draft.publishedAt && now - draft.publishedAt.getTime() > 7 * 86400e3) {
      drop = true;
      await prisma.draft.update({ where: { id: draft.id }, data: { videoUrl: null } });
    }
    if (drop) {
      await fs.rm(full, { force: true });
      removed++;
    }
  }
  return { removed };
}
