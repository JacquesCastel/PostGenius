import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const BG_DIR = process.env.IMAGE_DIR
  ? path.join(path.dirname(process.env.IMAGE_DIR), "backgrounds")
  : path.join(process.cwd(), "data", "backgrounds");

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(req, { params }) {
  const { file } = await params;
  // Sécurité : pas de path traversal
  if (!file || file.includes("..") || file.includes("/")) {
    return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
  }
  try {
    const filePath = path.join(BG_DIR, file);
    const buf = await fs.readFile(filePath);
    const ext = file.split(".").pop()?.toLowerCase() ?? "png";
    const mime = MIME[ext] ?? "image/png";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fond introuvable" }, { status: 404 });
  }
}
