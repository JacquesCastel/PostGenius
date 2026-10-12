import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// PATCH { used: true } — compte une insertion (les plus utilisés remontent) ; DELETE — retire le contenu
export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const r = await prisma.snippet.updateMany({ where: { id, userId }, data: { uses: { increment: 1 } } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Contenu introuvable." }, { status: 404 });
}

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const r = await prisma.snippet.deleteMany({ where: { id, userId } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Contenu introuvable." }, { status: 404 });
}
