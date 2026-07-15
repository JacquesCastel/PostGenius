import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveMediaFile, mediaPath } from "@/lib/media";
import fs from "fs/promises";

// POST /api/media/[id]/remove-bg
// Supprime l'arrière-plan d'un asset via remove.bg (REMOVE_BG_API_KEY requis).
// Sauvegarde le résultat en PNG transparent comme nouvel asset.
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  if (!process.env.REMOVE_BG_API_KEY) {
    return NextResponse.json(
      { error: "REMOVE_BG_API_KEY non configurée. Ajoutez-la dans votre .env." },
      { status: 501 }
    );
  }

  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset || asset.userId !== userId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  try {
    const originalBuffer = await fs.readFile(mediaPath(asset.fileName));

    // Appel API remove.bg
    const form = new FormData();
    const blob = new Blob([originalBuffer], { type: asset.mimeType || "image/png" });
    form.append("image_file", blob, asset.fileName);
    form.append("size", "auto");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.REMOVE_BG_API_KEY,
      },
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text();
      let msg = `remove.bg erreur ${res.status}`;
      try { msg = JSON.parse(txt).errors?.[0]?.title ?? msg; } catch {}
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const resultBuffer = Buffer.from(await res.arrayBuffer());

    // Dimensions via sharp
    let width = null, height = null;
    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(resultBuffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {}

    const { fileName, url } = await saveMediaFile(resultBuffer, "image/png");

    const newAsset = await prisma.mediaAsset.create({
      data: {
        userId,
        category: asset.category,
        fileName,
        url,
        width,
        height,
        mimeType: "image/png",
        sizeBytes: resultBuffer.byteLength,
      },
    });

    return NextResponse.json({ asset: newAsset });
  } catch (e) {
    console.error("Erreur remove-bg:", e);
    return NextResponse.json({ error: e.message || "Suppression du fond échouée." }, { status: 500 });
  }
}
