import { NextResponse } from "next/server";
import fsp from "fs/promises";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { looksLikeVideo, videoPath } from "@/lib/video";

// POST /api/videos/:uploadId/complete { size } — vérifie le fichier reçu et le valide.
// Renvoie { url } à stocker dans le brouillon (videoUrl).
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { file: uploadId } = await params;
  if (!/^[a-f0-9]{16}$/.test(uploadId)) return NextResponse.json({ error: "Envoi inconnu." }, { status: 404 });
  const { size } = await req.json().catch(() => ({}));

  const part = videoPath(`${userId}_${uploadId}.part`);
  let st;
  try {
    st = await fsp.stat(part);
  } catch {
    return NextResponse.json({ error: "Envoi inconnu ou expiré." }, { status: 404 });
  }
  if (st.size !== size) {
    return NextResponse.json({ error: `Fichier incomplet (${st.size} octets reçus sur ${size}).` }, { status: 400 });
  }
  if (!(await looksLikeVideo(part))) {
    await fsp.rm(part, { force: true });
    return NextResponse.json({ error: "Format non reconnu. Utilisez un fichier MP4 (ou MOV)." }, { status: 400 });
  }

  const name = `${userId}_${uploadId}.mp4`;
  await fsp.rename(part, videoPath(name));
  return NextResponse.json({ ok: true, url: `/api/videos/${name}` });
}
