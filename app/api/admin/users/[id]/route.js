import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

// Gestion d'un compte client : suspendre/réactiver, supprimer

export async function PATCH(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "Impossible de modifier votre propre compte." }, { status: 400 });
  }
  const { disabled } = await req.json();
  await prisma.user.update({ where: { id }, data: { disabled: Boolean(disabled) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte." }, { status: 400 });
  }
  // Cascade Prisma : drafts, campagnes, sources, usage, tokens LinkedIn
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
