import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import {
  INVITE_PLAN, INVITE_ACCESS_DAYS, INVITE_LINK_DAYS,
  inviteStatus, inviteUrl, isEmail, normalizeEmail, newInviteToken, linkExpiry, sendInvitationEmail,
} from "@/lib/invites";

// Invitations de test (admin) : liste et création (avec envoi de l'e-mail).

const view = (i) => ({
  id: i.id,
  email: i.email,
  note: i.note,
  status: inviteStatus(i),
  createdAt: i.createdAt,
  expiresAt: i.expiresAt,
  lastSentAt: i.lastSentAt,
  acceptedAt: i.acceptedAt,
  // Le lien n'est utile que tant que l'invitation peut être acceptée
  link: inviteStatus(i) === "pending" ? inviteUrl(i.token) : null,
});

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const list = await prisma.invitation.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({
    plan: INVITE_PLAN,
    accessDays: INVITE_ACCESS_DAYS,
    linkDays: INVITE_LINK_DAYS,
    invitations: list.map(view),
  });
}

export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (!isEmail(body.email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  const email = normalizeEmail(body.email);

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "Un compte existe déjà avec cette adresse." }, { status: 409 });
  }

  // Une seule invitation active par adresse : les précédentes en attente sont révoquées
  await prisma.invitation.updateMany({
    where: { email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const invitation = await prisma.invitation.create({
    data: {
      email,
      token: newInviteToken(),
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null,
      expiresAt: linkExpiry(),
      invitedBy: admin.id,
    },
  });

  const emailSent = await sendInvitationEmail(invitation, admin.name);
  const saved = emailSent
    ? await prisma.invitation.update({ where: { id: invitation.id }, data: { lastSentAt: new Date() } })
    : invitation;
  return NextResponse.json({ invitation: view(saved), emailSent });
}
