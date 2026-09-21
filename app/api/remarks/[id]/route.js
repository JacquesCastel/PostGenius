import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  // deleteMany + userId : on ne peut supprimer que ses propres remarques
  const { count } = await prisma.postRemark.deleteMany({ where: { id, userId } });
  if (!count) return NextResponse.json({ error: "Remarque introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
