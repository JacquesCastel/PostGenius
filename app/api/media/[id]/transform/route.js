import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveMediaFile, mediaPath } from "@/lib/media";
import fs from "fs/promises";

// POST /api/media/[id]/transform
// Applique une ou plusieurs transformations via Sharp et sauvegarde un nouvel asset.
//
// Body (toutes les transformations sont optionnelles et combinables) :
// {
//   crop?:   { left, top, width, height }  — pixels entiers positifs
//   resize?: { width?, height?, fit? }      — fit : cover | contain | fill (défaut cover)
//   filter?: { brightness?, contrast?, saturation?, blur? }  — facteurs (1.0 = inchangé)
//   text?:   { text, fontSize?, color?, posH?, posV? }       — overlay SVG
//   category?: string  — catégorie du nouvel asset (défaut = même que l'original)
// }
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset || asset.userId !== userId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { crop, resize, filter, text, category } = body;

  try {
    const sharp = (await import("sharp")).default;
    let img = sharp(mediaPath(asset.fileName));

    // 1. Recadrage
    if (crop) {
      const { left = 0, top = 0, width, height } = crop;
      if (width > 0 && height > 0) {
        img = img.extract({
          left: Math.max(0, Math.round(left)),
          top:  Math.max(0, Math.round(top)),
          width:  Math.round(width),
          height: Math.round(height),
        });
      }
    }

    // 2. Redimensionnement
    if (resize && (resize.width || resize.height)) {
      img = img.resize({
        width:  resize.width  ? Math.round(resize.width)  : undefined,
        height: resize.height ? Math.round(resize.height) : undefined,
        fit:    resize.fit ?? "cover",
        withoutEnlargement: false,
      });
    }

    // 3. Filtres couleur
    if (filter) {
      const br = filter.brightness ?? 1;
      const sa = filter.saturation ?? 1;
      const co = filter.contrast   ?? 1;
      const bl = filter.blur       ?? 0;

      // modulate gère luminosité et saturation
      if (br !== 1 || sa !== 1) img = img.modulate({ brightness: br, saturation: sa });
      // linear(a, b) : pixel_out = a * pixel_in + b (contraste autour de 128)
      if (co !== 1) img = img.linear(co, -(128 * co - 128) / 255);
      if (bl > 0) img = img.blur(Math.max(0.3, bl));
    }

    // Récupère le buffer avant overlay texte (besoin des dimensions)
    const intermediate = await img.png().toBuffer();

    // 4. Texte overlay (SVG composite)
    let final = intermediate;
    if (text?.text) {
      const meta   = await sharp(intermediate).metadata();
      const w      = meta.width  ?? 1200;
      const h      = meta.height ?? 630;
      const size   = text.fontSize ?? 48;
      const color  = text.color   ?? "#ffffff";
      const posH   = text.posH    ?? "center"; // left | center | right
      const posV   = text.posV    ?? "bottom"; // top | center | bottom
      const padding = Math.round(size * 0.6);

      const xAnchor = posH === "left" ? padding : posH === "right" ? w - padding : Math.round(w / 2);
      const yAnchor = posV === "top"  ? padding + size
                    : posV === "center" ? Math.round(h / 2)
                    : h - padding;
      const textAnchor = posH === "left" ? "start" : posH === "right" ? "end" : "middle";

      // Ombre portée pour lisibilité
      const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <text
    x="${xAnchor}" y="${yAnchor}"
    font-family="Arial, sans-serif"
    font-size="${size}"
    font-weight="bold"
    fill="${color}"
    text-anchor="${textAnchor}"
    filter="url(#shadow)"
  >${text.text.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]))}</text>
</svg>`);

      final = await sharp(intermediate)
        .composite([{ input: svg, blend: "over" }])
        .png()
        .toBuffer();
    }

    // Dimensions finales
    const meta = await sharp(final).metadata();
    const { fileName, url } = await saveMediaFile(final, "image/png");

    const newAsset = await prisma.mediaAsset.create({
      data: {
        userId,
        category: category ?? asset.category,
        fileName,
        url,
        width:     meta.width  ?? null,
        height:    meta.height ?? null,
        mimeType:  "image/png",
        sizeBytes: final.byteLength,
      },
    });

    return NextResponse.json({ asset: newAsset });
  } catch (e) {
    console.error("Erreur transform:", e);
    return NextResponse.json({ error: e.message || "Transformation échouée." }, { status: 500 });
  }
}
