import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { prisma } from "./db";
import { logUsage } from "./usage";
import { checkMediaQuota } from "./gating";
import { transcribe, transcribeLanguage } from "./voice";

// Vidéo ou audio de « Seconde vie d'un contenu » : le navigateur envoie le fichier par morceaux (les routes /api plafonnent chaque requête),
// puis le serveur en tire l'audio (ffmpeg), le découpe en tranches de 5 minutes, les fait transcrire et recolle le texte avec des repères
// horaires [mm:ss]. Le fichier est supprimé dès que c'est fait, ou en cas d'échec. Seule la transcription est gardée, 24 h au plus.

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
export const MAX_BYTES = num(process.env.MEDIA_MAX_MB, 200) * 1024 * 1024;
export const MAX_SECONDS = num(process.env.MEDIA_MAX_MINUTES, 60) * 60;
export const CHUNK_BYTES = 8 * 1024 * 1024; // taille de morceau demandée au navigateur
export const MAX_CHUNK_BYTES = 10 * 1024 * 1024; // au-delà, un morceau est refusé
const SEGMENT_SECONDS = 300; // une tranche de 5 minutes = un repère horaire
const ACTIVE_LIMIT = 2; // envois ou traitements en cours par personne
const KEEP_MS = 24 * 3600e3; // durée de conservation d'un travail et de sa transcription
const STALE_MS = 15 * 60e3; // un traitement muet depuis 15 minutes est considéré interrompu (redémarrage du serveur)
const UPLOAD_STALE_MS = 3 * 3600e3;
const TMP_ROOT = process.env.MEDIA_TMP_DIR || path.join(os.tmpdir(), "lkp-media");
const EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "mkv", "avi", "mp3", "m4a", "wav", "ogg", "aac", "flac", "opus"]);

export class MediaError extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

const dirOf = (id) => path.join(TMP_ROOT, id);
const fileOf = (id) => path.join(dirOf(id), "source");
const rmDir = (id) => fs.rm(dirOf(id), { recursive: true, force: true }).catch(() => {});
const squash = (t, n) => String(t ?? "").replace(/[\u0000-\u001f\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

export const stamp = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(r)}` : `${two(m)}:${two(r)}`;
};

const view = (j) => ({
  id: j.id, status: j.status, step: j.step, progress: j.progress, fileName: j.fileName, durationSec: j.durationSec,
  receivedBytes: j.receivedBytes, sizeBytes: j.sizeBytes, error: j.error ?? null, transcript: j.status === "done" ? j.transcript : null,
});

// Nettoyage : travaux de plus de 24 h, envois abandonnés, dossiers orphelins de plus de 6 h
async function purge() {
  const old = await prisma.mediaJob.findMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } }, select: { id: true } });
  for (const j of old) await rmDir(j.id);
  if (old.length) await prisma.mediaJob.deleteMany({ where: { id: { in: old.map((j) => j.id) } } });
  let names = [];
  try { names = await fs.readdir(TMP_ROOT); } catch { return; }
  for (const n of names) {
    try {
      const st = await fs.stat(path.join(TMP_ROOT, n));
      if (Date.now() - st.mtimeMs > 6 * 3600e3) await fs.rm(path.join(TMP_ROOT, n), { recursive: true, force: true });
    } catch {}
  }
}

export async function createJob(userId, { name, size, language }) {
  const fileName = squash(name, 120) || "enregistrement";
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!EXTENSIONS.has(ext)) throw new MediaError("Format non pris en charge. Formats acceptés : mp4, mov, webm, mkv, mp3, m4a, wav, ogg, aac, flac.", 415);
  const bytes = Math.floor(Number(size));
  if (!Number.isFinite(bytes) || bytes < 1024) throw new MediaError("Fichier vide ou illisible.");
  if (bytes > MAX_BYTES) throw new MediaError(`Fichier trop volumineux : ${Math.round(MAX_BYTES / 1048576)} Mo au maximum. Vous pouvez aussi coller la transcription du contenu.`, 413);
  purge().catch(() => {});
  const active = await prisma.mediaJob.count({ where: { userId, status: { in: ["uploading", "queued", "processing"] }, updatedAt: { gte: new Date(Date.now() - UPLOAD_STALE_MS) } } });
  if (active >= ACTIVE_LIMIT) throw new MediaError("Vous avez déjà des fichiers en cours : attendez leur fin, ou annulez-les.", 429);
  const quota = await checkMediaQuota(userId, 0);
  if (!quota.ok) throw new MediaError(quota.error, 403, { quota });
  const job = await prisma.mediaJob.create({ data: { userId, fileName, sizeBytes: bytes, language: transcribeLanguage(language) } });
  await fs.mkdir(dirOf(job.id), { recursive: true });
  await fs.writeFile(fileOf(job.id), "");
  return { job: view(job), chunkBytes: CHUNK_BYTES };
}

async function ownJob(userId, id) {
  const job = await prisma.mediaJob.findFirst({ where: { id: String(id ?? ""), userId } });
  if (!job) throw new MediaError("Envoi introuvable ou expiré.", 404);
  return job;
}

// Morceaux reçus dans l'ordre : `offset` doit être l'endroit où l'on en est, sinon on dit au navigateur où reprendre
export async function appendChunk(userId, id, offset, buffer) {
  const job = await ownJob(userId, id);
  if (job.status !== "uploading") throw new MediaError("Cet envoi est terminé.", 409);
  if (!buffer?.length || buffer.length > MAX_CHUNK_BYTES) throw new MediaError("Morceau invalide.", 400);
  if (Number(offset) !== job.receivedBytes) throw new MediaError("Morceau hors séquence.", 409, { receivedBytes: job.receivedBytes });
  if (job.receivedBytes + buffer.length > job.sizeBytes) throw new MediaError("Le fichier reçu dépasse la taille annoncée.", 400);
  await fs.appendFile(fileOf(job.id), buffer);
  const upd = await prisma.mediaJob.update({ where: { id: job.id }, data: { receivedBytes: job.receivedBytes + buffer.length } });
  return { receivedBytes: upd.receivedBytes };
}

export async function startJob(userId, id) {
  const job = await ownJob(userId, id);
  if (job.status !== "uploading") throw new MediaError("Cet envoi est déjà lancé.", 409);
  if (job.receivedBytes !== job.sizeBytes) throw new MediaError("Le fichier n'est pas arrivé en entier : relancez l'envoi.", 409, { receivedBytes: job.receivedBytes });
  const upd = await prisma.mediaJob.update({ where: { id: job.id }, data: { status: "queued", step: "extraction", progress: 1 } });
  runJob(job.id).catch((e) => console.error("[media]", job.id, e));
  return view(upd);
}

export async function getJob(userId, id) {
  let job = await ownJob(userId, id);
  const age = Date.now() - job.updatedAt.getTime();
  if ((job.status === "queued" || job.status === "processing") && age > STALE_MS) {
    job = await prisma.mediaJob.update({ where: { id: job.id }, data: { status: "error", error: "Le traitement a été interrompu (redémarrage du serveur). Relancez l'envoi du fichier." } });
    await rmDir(job.id);
  } else if (job.status === "uploading" && age > UPLOAD_STALE_MS) {
    job = await prisma.mediaJob.update({ where: { id: job.id }, data: { status: "error", error: "Envoi abandonné : relancez-le." } });
    await rmDir(job.id);
  }
  return view(job);
}

export async function deleteJob(userId, id) {
  const job = await ownJob(userId, id);
  await rmDir(job.id);
  await prisma.mediaJob.delete({ where: { id: job.id } }).catch(() => {});
}

// --- Traitement ---------------------------------------------------------------------------------------------------------------

let running = 0;
const waiting = [];
const maxParallel = () => num(process.env.MEDIA_CONCURRENCY, 2);
const acquire = () => new Promise((resolve) => { if (running < maxParallel()) { running++; resolve(); } else waiting.push(resolve); });
const release = () => { const next = waiting.shift(); if (next) next(); else running--; };

const run = (cmd, args, timeout) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => (err ? reject(Object.assign(err, { stderr })) : resolve(stdout)));
});

// Durée et présence d'une piste audio ; le fichier est examiné par ffprobe, pas jugé sur son nom
async function probe(file) {
  let out;
  try { out = await run("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type:format=duration", "-of", "json", file], 30_000); }
  catch (e) {
    if (e.code === "ENOENT") throw new MediaError("Le traitement des vidéos n'est pas disponible sur ce serveur.", 503);
    throw new MediaError("Ce fichier n'est pas une vidéo ou un audio lisible.");
  }
  const info = JSON.parse(out || "{}");
  if (!info.streams?.length) throw new MediaError("Ce fichier ne contient aucune piste audio : il n'y a rien à transcrire.");
  const seconds = Math.ceil(Number(info.format?.duration));
  if (!Number.isFinite(seconds) || seconds < 3) throw new MediaError("Enregistrement trop court ou durée illisible.");
  return seconds;
}

const setJob = (id, data) => prisma.mediaJob.update({ where: { id }, data });

async function runJob(id) {
  await acquire();
  try {
    const job = await prisma.mediaJob.findUnique({ where: { id } });
    if (!job) return;
    await setJob(id, { status: "processing", step: "extraction", progress: 2 });
    const src = fileOf(id);
    const seconds = await probe(src);
    if (seconds > MAX_SECONDS + 30) throw new MediaError(`Cet enregistrement dure ${Math.ceil(seconds / 60)} min : ${Math.round(MAX_SECONDS / 60)} min au maximum. Découpez-le, ou collez sa transcription.`);
    const quota = await checkMediaQuota(job.userId, seconds);
    if (!quota.ok) throw new MediaError(quota.error, 403);
    await setJob(id, { durationSec: seconds, progress: 5 });

    // Audio seul, mono 16 kHz, 32 kbit/s, en tranches de 5 minutes (environ 1,2 Mo chacune, bien sous la limite du service)
    const dir = dirOf(id);
    try {
      await run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", src, "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "-f", "segment", "-segment_time", String(SEGMENT_SECONDS), "-reset_timestamps", "1", path.join(dir, "seg_%03d.mp3")], 20 * 60_000);
    } catch (e) {
      console.error("[media] ffmpeg", id, String(e.stderr ?? e.message).slice(0, 500));
      throw new MediaError("Impossible d'extraire l'audio de ce fichier. Essayez un autre format (mp4 ou mp3).");
    }
    await fs.rm(src, { force: true }); // l'original n'est plus utile
    const segs = (await fs.readdir(dir)).filter((n) => /^seg_\d+\.mp3$/.test(n)).sort();
    if (!segs.length) throw new MediaError("Aucun son n'a pu être extrait de ce fichier.");

    await setJob(id, { step: "transcription", progress: 15 });
    const parts = [];
    for (let i = 0; i < segs.length; i++) {
      const buffer = await fs.readFile(path.join(dir, segs[i]));
      let text = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        try { text = await transcribe({ buffer, mime: "audio/mpeg", language: job.language }); break; }
        catch (e) { if (attempt === 1) throw new MediaError(e.message || "Transcription impossible pour le moment.", e.status || 502); }
      }
      if (text) parts.push(`[${stamp(i * SEGMENT_SECONDS)}] ${text}`);
      await setJob(id, { progress: 15 + Math.round(((i + 1) / segs.length) * 84) });
    }
    const transcript = parts.join("\n\n").trim();
    if (!transcript) throw new MediaError("Aucune parole reconnue dans ce fichier.");
    logUsage(job.userId, { kind: "media", context: "seconde vie : vidéo ou audio", seconds });
    await setJob(id, { status: "done", step: null, progress: 100, transcript });
  } catch (e) {
    const message = e instanceof MediaError ? e.message : "Le traitement a échoué. Réessayez, ou collez la transcription du contenu.";
    if (!(e instanceof MediaError)) console.error("[media]", id, e);
    await setJob(id, { status: "error", error: message, step: null }).catch(() => {});
  } finally {
    await rmDir(id);
    release();
  }
}
