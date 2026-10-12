import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { readImageFromUrl } from "@/lib/image";
import { imagesToPdf } from "@/lib/pdf";
import { cleanSlides } from "@/lib/postExtras";

// POST { urls } → PDF du carrousel (une slide par page), à télécharger ou à relire avant publication
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { urls } = await req.json().catch(() => ({}));
  const slides = cleanSlides(urls);
  if (!slides.length) return NextResponse.json({ error: "Aucune slide valable." }, { status: 400 });
  try {
    const pdf = await imagesToPdf(await Promise.all(slides.map((u) => readImageFromUrl(u))));
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="carrousel.pdf"', "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("carousel-pdf:", e.message);
    return NextResponse.json({ error: "Images introuvables : régénérez les slides." }, { status: 404 });
  }
}
