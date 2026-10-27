import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveMediaFile } from "@/lib/media";
import { logUsage } from "@/lib/usage";
import { checkAccess } from "@/lib/gating";
import { generateImageB64 } from "@/lib/openaiImage";

export const maxDuration = 120;

// POST /api/media/generate
// Body : { prompt: string, category?: "generated" }
// Génère une image via OpenAI (modèles gpt-image, voir lib/openaiImage.js) et la sauvegarde en médiathèque.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY manquante dans .env." },
      { status: 500 }
    );
  }

  const { prompt, category = "generated" } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt requis." }, { status: 400 });
  }

  try {
    const gen = await generateImageB64(prompt.trim());
    if (gen.error) return NextResponse.json({ error: gen.error }, { status: gen.status });
    const b64 = gen.b64;

    const buffer = Buffer.from(b64, "base64");

    // Dimensions
    let width = null, height = null;
    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {}

    const { fileName, url } = await saveMediaFile(buffer, "image/png");

    const asset = await prisma.mediaAsset.create({
      data: {
        userId,
        category,
        fileName,
        url,
        width,
        height,
        mimeType: "image/png",
        sizeBytes: buffer.byteLength,
        prompt: prompt.trim(),
      },
    });

    logUsage(userId, { kind: "image", context: "mediathèque", images: 1 });
    return NextResponse.json({ asset });
  } catch (e) {
    console.error("Erreur génération médiathèque:", e);
    return NextResponse.json({ error: e.message || "Échec de la génération." }, { status: 500 });
  }
}
