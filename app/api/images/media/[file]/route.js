import { NextResponse } from "next/server";
import fs from "fs/promises";
import { mediaPath } from "@/lib/media";

const MIME = {
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif:  "image/gif",
};

export async function GET(req, { params }) {
  const { file } = await params;
  if (!file || file.includes("..") || file.includes("/")) {
    return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(mediaPath(file));
    const ext = file.split(".").pop()?.toLowerCase() ?? "png";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": MIME[ext] ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
