import { NextResponse } from "next/server";
import { getContextFor } from "@/lib/contexts";
import { findKit, saveKit } from "@/lib/brandKitStore";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const BG_DIR = process.env.IMAGE_DIR
  ? path.join(path.dirname(process.env.IMAGE_DIR), "backgrounds")
  : path.join(process.cwd(), "data", "backgrounds");

// POST /api/brand-kit/background — upload de l'image de fond (multipart/form-data, champ "file")
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const formData = await req.formData();
  const contextId = String(formData.get("contextId") ?? "") || null;
  if (contextId && !(await getContextFor(userId, contextId))) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 400 });
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  // PNG, JPG, WEBP (pas de SVG : Satori charge le fond en bitmap)
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Format non supporté. Utilisez PNG, JPG ou WEBP." }, { status: 400 });
  }

  // Limite à 5 Mo (image plein format 1080×1080)
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop lourd (max 5 Mo)" }, { status: 400 });
  }

  await fs.mkdir(BG_DIR, { recursive: true });
  const ext = file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
  const fileName = `${userId}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(BG_DIR, fileName), buffer);

  const backgroundUrl = `/api/images/backgrounds/${fileName}`;

  await saveKit(userId, contextId, { backgroundUrl });

  return NextResponse.json({ backgroundUrl });
}

// DELETE /api/brand-kit/background — retire l'image de fond (retour au fond couleur)
export async function DELETE(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const contextId = new URL(req.url).searchParams.get("contextId") || null;
  const kit = await findKit(userId, contextId);
  if (kit) await prisma.brandKit.update({ where: { id: kit.id }, data: { backgroundUrl: null } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
