import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { inviteStatus, linkExpiry, sendInvitationEmail } from "@/lib/invites";

// Invitation de test : renvoyer l'e-mail (PATCH) ou révoquer (DELETE).

export async function PATCH(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await params;
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
  if (inv.acceptedAt || inv.revokedAt) {
    return NextResponse.json({ error: "Cette invitation n'est plus active." }, { status: 409 });
  }
  // Un nouvel envoi prolonge la validité du lien (même lien)
  const renewed = await prisma.invitation.update({ where: { id }, data: { expiresAt: linkExpiry() } });
  const emailSent = await sendInvitationEmail(renewed, admin.name);
  if (emailSent) await prisma.invitation.update({ where: { id }, data: { lastSentAt: new Date() } });
  return NextResponse.json({ ok: true, emailSent });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await params;
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Invitation introuvable." }, { status: 404 });
  if (inviteStatus(inv) === "accepted") {
    return NextResponse.json({ error: "Invitation déjà acceptée : le compte existe." }, { status: 409 });
  }
  await prisma.invitation.update({ where: { id }, data: { revokedAt: inv.revokedAt ?? new Date() } });
  return NextResponse.json({ ok: true });
}
