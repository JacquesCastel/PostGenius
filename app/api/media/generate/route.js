import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveMediaFile } from "@/lib/media";
import { logUsage } from "@/lib/usage";
import { checkAccess } from "@/lib/gating";

export const maxDuration = 120;

// POST /api/media/generate
// Body : { prompt: string, category?: "generated" }
// Génère une image via OpenAI (gpt-image-1 ou dall-e-3) et la sauvegarde en médiathèque.
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
    let b64 = null;
    for (const cfg of [
      { model: "gpt-image-1", size: "1536x1024", quality: "medium" },
      { model: "dall-e-3",    size: "1792x1024", quality: "standard", response_format: "b64_json" },
    ]) {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt.trim(), n: 1, ...cfg }),
      });
      if (res.ok) {
        const data = await res.json();
        b64 = data.data?.[0]?.b64_json ?? null;
        if (b64) break;
      } else {
        const status = res.status;
        if (status === 403 || status === 404 || status === 400) continue;
        const txt = await res.text();
        let detail = "";
        try { detail = JSON.parse(txt).error?.message ?? ""; } catch {}
        return NextResponse.json(
          { error: `Génération refusée (${status})${detail ? ": " + detail : ""}` },
          { status: 502 }
        );
      }
    }
    if (!b64) throw new Error("Aucun modèle disponible — vérifiez votre clé OpenAI.");

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
