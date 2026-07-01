import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { renderPostTemplate, renderCarouselTemplate } from "@/lib/templates";
import { saveImage } from "@/lib/image";

export const maxDuration = 60;

const DEFAULT_KIT = {
  primaryColor:   "#0a66c2",
  secondaryColor: "#ffffff",
  accentColor:    "#ff5a5f",
  logoUrl:        null,
  fontFamily:     "Inter",
  bgStyle:        "solid",
  tagline:        null,
};

/**
 * POST /api/image/template
 *
 * Body :
 *  { type: "post", text: "…" }
 *  { type: "carousel", slides: [{ type: "title"|"content"|"end", title, body, subtitle, cta }] }
 *
 * Retourne :
 *  { urls: ["/api/images/xxx.png", …] }  (1 URL pour post, N pour carrousel)
 */
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = await req.json();
  const { type = "post", text, slides, draftId } = body;

  try {
    // Charge le BrandKit de l'utilisateur (ou valeurs par défaut)
    const kitRow = await prisma.brandKit.findUnique({ where: { userId } });
    const kit = kitRow ?? DEFAULT_KIT;

    // Si le logo est une URL relative (/api/images/logos/…), on le résout en URL absolue
    // pour que Satori puisse le charger (il a besoin d'une URL absolue ou d'une data URL)
    if (kit.logoUrl?.startsWith("/")) {
      const base = process.env.APP_URL ?? "http://localhost:3000";
      kit.logoUrl = `${base}${kit.logoUrl}`;
    }

    let urls = [];

    if (type === "carousel") {
      if (!Array.isArray(slides) || slides.length === 0) {
        return NextResponse.json({ error: "slides requis pour le type carrousel" }, { status: 400 });
      }
      const pngs = await renderCarouselTemplate({ slides, brandKit: kit });
      for (const png of pngs) {
        const b64 = png.toString("base64");
        const { url } = await saveImage(b64);
        urls.push(url);
      }
    } else {
      if (!text?.trim()) {
        return NextResponse.json({ error: "text requis pour le type post" }, { status: 400 });
      }
      const png = await renderPostTemplate({ text, brandKit: kit });
      const b64 = png.toString("base64");
      const { url } = await saveImage(b64);
      urls = [url];
    }

    // Met à jour le draft si draftId fourni
    if (draftId && urls.length > 0) {
      await prisma.draft.update({
        where: { id: draftId },
        data: { imageUrl: urls[0] },
      }).catch(() => {}); // Non bloquant
    }

    return NextResponse.json({ urls });
  } catch (e) {
    console.error("Erreur génération gabarit:", e);
    return NextResponse.json({ error: e.message || "Échec de la génération" }, { status: 500 });
  }
}
