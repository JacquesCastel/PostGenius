import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveMediaFile } from "@/lib/media";

// GET /api/media?category=background|generated|asset|logo
// Liste les assets de la médiathèque de l'utilisateur
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const assets = await prisma.mediaAsset.findMany({
    where: { userId, ...(category ? { category } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assets });
}

// POST /api/media (multipart/form-data)
// Champs : file (File), category (string, default "asset")
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const category = (formData.get("category") || "asset").toString();

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté (PNG, JPG, WEBP uniquement)" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop lourd (max 10 Mo)" }, { status: 400 });
  }

  // Dimensions via sharp (non bloquant si sharp absent)
  let width = null;
  let height = null;
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {}

  const { fileName, url } = await saveMediaFile(buffer, file.type);

  const asset = await prisma.mediaAsset.create({
    data: {
      userId,
      category,
      fileName,
      url,
      width,
      height,
      mimeType: file.type,
      sizeBytes: buffer.byteLength,
    },
  });

  return NextResponse.json({ asset });
}
