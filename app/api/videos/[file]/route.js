import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import { Readable } from "stream";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { MAX_VIDEO_BYTES, VIDEO_CHUNK, parseVideoName, videoPath } from "@/lib/video";

// PUT  /api/videos/:uploadId?index=n — ajoute le morceau n (corps binaire brut)
// GET  /api/videos/:fichier.mp4 — lit la vidéo (aperçu), avec Range ; propriétaire uniquement

export async function PUT(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { file: uploadId } = await params;
  if (!/^[a-f0-9]{16}$/.test(uploadId)) return NextResponse.json({ error: "Envoi inconnu." }, { status: 404 });
  const index = Number(new URL(req.url).searchParams.get("index"));
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Index de morceau invalide." }, { status: 400 });
  }

  const target = videoPath(`${userId}_${uploadId}.part`);
  let size;
  try {
    size = (await fsp.stat(target)).size;
  } catch {
    return NextResponse.json({ error: "Envoi inconnu ou expiré." }, { status: 404 });
  }
  // Morceaux strictement dans l'ordre : le fichier doit avoir exactement index × taille de morceau
  if (size !== index * VIDEO_CHUNK) {
    return NextResponse.json({ error: "Morceau hors séquence.", expectedIndex: Math.floor(size / VIDEO_CHUNK) }, { status: 409 });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > VIDEO_CHUNK) {
    return NextResponse.json({ error: "Taille de morceau invalide." }, { status: 400 });
  }
  if (size + buf.length > MAX_VIDEO_BYTES) {
    await fsp.rm(target, { force: true });
    return NextResponse.json({ error: "Vidéo trop lourde (200 Mo maximum)." }, { status: 413 });
  }
  await fsp.appendFile(target, buf);
  return NextResponse.json({ ok: true, received: size + buf.length });
}

export async function GET(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { file } = await params;
  const p = parseVideoName(file);
  if (!p || p.ext !== "mp4" || p.userId !== userId) {
    return NextResponse.json({ error: "Vidéo introuvable." }, { status: 404 });
  }
  const full = videoPath(file);
  let st;
  try {
    st = await fsp.stat(full);
  } catch {
    return NextResponse.json({ error: "Vidéo introuvable." }, { status: 404 });
  }

  let start = 0;
  let end = st.size - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), end);
    } else {
      start = Math.max(st.size - Number(range[2]), 0); // "-N" = les N derniers octets
    }
    if (start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${st.size}` } });
    }
  }
  const partial = Boolean(range);
  const stream = Readable.toWeb(fs.createReadStream(full, { start, end }));
  return new NextResponse(stream, {
    status: partial ? 206 : 200,
    headers: {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      ...(partial ? { "Content-Range": `bytes ${start}-${end}/${st.size}` } : {}),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
