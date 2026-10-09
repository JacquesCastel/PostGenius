import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// Retire une page de la liste des pages enregistrées (les posts déjà écrits gardent leur mention).
export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const { count } = await prisma.savedMention.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
