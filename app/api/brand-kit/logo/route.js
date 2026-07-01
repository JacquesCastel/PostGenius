import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const LOGO_DIR = process.env.IMAGE_DIR
  ? path.join(path.dirname(process.env.IMAGE_DIR), "logos")
  : path.join(process.cwd(), "data", "logos");

// POST /api/brand-kit/logo — upload du logo (multipart/form-data, champ "file")
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  // Vérification type MIME (PNG, JPG, SVG, WEBP acceptés)
  const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Format non supporté. Utilisez PNG, JPG ou SVG." }, { status: 400 });
  }

  // Limite à 2 Mo
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop lourd (max 2 Mo)" }, { status: 400 });
  }

  await fs.mkdir(LOGO_DIR, { recursive: true });
  const ext = file.type === "image/svg+xml" ? "svg"
    : file.type === "image/webp" ? "webp"
    : file.type === "image/jpeg" ? "jpg"
    : "png";
  const fileName = `${userId}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(LOGO_DIR, fileName), buffer);

  const logoUrl = `/api/images/logos/${fileName}`;

  // Enregistre l'URL dans le BrandKit
  await prisma.brandKit.upsert({
    where: { userId },
    update: { logoUrl },
    create: { userId, logoUrl },
  });

  return NextResponse.json({ logoUrl });
}
