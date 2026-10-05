import { NextResponse } from "next/server";
import fs from "fs/promises";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import {
  VIDEO_DIR, MAX_VIDEO_BYTES, MAX_USER_VIDEO_BYTES, VIDEO_CHUNK,
  newVideoName, userVideoBytes,
} from "@/lib/video";

// POST /api/videos { size } — ouvre un envoi par morceaux.
// Renvoie { uploadId, chunkSize }. Les morceaux vont ensuite à PUT /api/videos/:uploadId?index=n,
// puis POST /api/videos/:uploadId/complete.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { size } = await req.json().catch(() => ({}));
  if (!Number.isInteger(size) || size <= 0) {
    return NextResponse.json({ error: "Taille de fichier invalide." }, { status: 400 });
  }
  if (size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "Vidéo trop lourde (200 Mo maximum)." }, { status: 413 });
  }
  if ((await userVideoBytes(userId)) + size > MAX_USER_VIDEO_BYTES) {
    return NextResponse.json(
      { error: "Espace vidéo plein (1 Go). Publiez ou supprimez des posts avec vidéo." },
      { status: 413 }
    );
  }

  await fs.mkdir(VIDEO_DIR, { recursive: true });
  const name = newVideoName(userId);
  await fs.writeFile(`${VIDEO_DIR}/${name}.part`, "");
  return NextResponse.json({ uploadId: name.split("_")[1], chunkSize: VIDEO_CHUNK });
}
