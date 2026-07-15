import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { deleteMediaFile } from "@/lib/media";

// DELETE /api/media/[id]
export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset || asset.userId !== userId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  await deleteMediaFile(asset.fileName);
  await prisma.mediaAsset.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

// PATCH /api/media/[id] — renommer ou changer la catégorie
export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset || asset.userId !== userId) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const { category } = await req.json();
  const updated = await prisma.mediaAsset.update({
    where: { id },
    data: { ...(category ? { category } : {}) },
  });

  return NextResponse.json({ asset: updated });
}
