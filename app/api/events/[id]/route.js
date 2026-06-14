import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// Édition / suppression d'un événement (du client connecté)

async function owned(userId, id) {
  const ev = await prisma.event.findUnique({ where: { id } });
  return ev && ev.userId === userId ? ev : null;
}

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  if (!(await owned(userId, id))) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const body = await req.json();
  const data = {};
  for (const k of ["name", "location", "url", "imageUrl", "details"]) {
    if (k in body) data[k] = body[k]?.toString().trim() || null;
  }
  if (body.startDate) data.startDate = new Date(body.startDate);
  if (body.endDate) data.endDate = new Date(body.endDate);

  const event = await prisma.event.update({ where: { id }, data });
  return NextResponse.json({ event });
}

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  if (!(await owned(userId, id))) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
