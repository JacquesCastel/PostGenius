import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

// Marquer traité/non traité, ou supprimer une demande (admin)
export async function PATCH(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  const { handled } = await req.json();
  await prisma.contactMessage.update({ where: { id }, data: { handled: Boolean(handled) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  await prisma.contactMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
