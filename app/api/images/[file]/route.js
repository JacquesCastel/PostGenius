import { NextResponse } from "next/server";
import fs from "fs/promises";
import { imagePath } from "@/lib/image";

// Sert les images générées (stockées hors de /public pour survivre aux rebuilds)

export async function GET(req, { params }) {
  const { file } = await params;
  try {
    const buf = await fs.readFile(imagePath(file));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }
}
