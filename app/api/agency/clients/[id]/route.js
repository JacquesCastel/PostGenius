import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// DELETE /api/agency/clients/[id] — supprime un client et toutes ses données
export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id: clientId } = await params;

  // Vérifie que ce client appartient bien à cette agence
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { managedByUserId: true },
  });
  if (!client || client.managedByUserId !== userId) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  // Cascade via Prisma (onDelete: Cascade sur toutes les relations User)
  await prisma.user.delete({ where: { id: clientId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/agency/clients/[id] — met à jour le profil client
export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id: clientId } = await params;
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { managedByUserId: true },
  });
  if (!client || client.managedByUserId !== userId) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const allowed = ["name", "companyName", "headline", "expertise", "themes", "tone",
    "styleNotes", "website", "businessDescription", "targetAudience"];
  const data = {};
  for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];

  const updated = await prisma.user.update({ where: { id: clientId }, data });
  return NextResponse.json({ client: updated });
}
