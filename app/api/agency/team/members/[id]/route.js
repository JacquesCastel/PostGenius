import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/agency";

// DELETE : retire un collaborateur de l'agence (propriétaire). Son compte reste, sans l'accès de l'agence : il perd aussitôt
// les clients (y compris une session déjà ouverte) et doit s'abonner pour continuer à son compte.
export async function DELETE(req, { params }) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role !== "owner") return NextResponse.json({ error: "Seul le propriétaire de l'agence peut retirer un collaborateur." }, { status: 403 });
  const { id } = await params;
  if (id === auth.userId) return NextResponse.json({ error: "Le propriétaire ne peut pas se retirer de l'agence." }, { status: 400 });
  const member = await prisma.agencyMember.findFirst({ where: { agencyId: auth.agencyId, userId: id }, select: { id: true, role: true } });
  if (!member || member.role === "owner") return NextResponse.json({ error: "Collaborateur introuvable." }, { status: 404 });
  await prisma.$transaction([
    prisma.agencyMember.delete({ where: { id: member.id } }),
    // Plus d'accès offert par l'agence : essai terminé, offre ramenée au Pro (abonnement à souscrire)
    prisma.user.update({ where: { id }, data: { plan: "pro", trialEndsAt: new Date(), planUpdatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}
