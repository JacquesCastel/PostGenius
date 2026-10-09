import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/agency";
import { teamLinkExpiry, teamInviteView, sendTeamInviteEmail } from "@/lib/agencyTeam";
import { inviteStatus } from "@/lib/invites";

async function own(req, params) {
  const auth = await requireAgency(req);
  if (auth.error) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.role !== "owner") return { res: NextResponse.json({ error: "Réservé au propriétaire de l'agence." }, { status: 403 }) };
  const { id } = await params;
  const invite = await prisma.agencyInvite.findFirst({ where: { id, agencyId: auth.agencyId } });
  if (!invite) return { res: NextResponse.json({ error: "Invitation introuvable." }, { status: 404 }) };
  return { auth, invite };
}

// DELETE : révoque l'invitation (le lien cesse de fonctionner)
export async function DELETE(req, { params }) {
  const r = await own(req, params);
  if (r.res) return r.res;
  if (!r.invite.acceptedAt) await prisma.agencyInvite.update({ where: { id: r.invite.id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

// POST : renvoie l'e-mail et prolonge la validité du lien
export async function POST(req, { params }) {
  const r = await own(req, params);
  if (r.res) return r.res;
  if (r.invite.acceptedAt || r.invite.revokedAt) return NextResponse.json({ error: "Cette invitation n'est plus active." }, { status: 409 });
  const invite = await prisma.agencyInvite.update({ where: { id: r.invite.id }, data: { expiresAt: teamLinkExpiry(), lastSentAt: new Date() } });
  const [agency, me] = await Promise.all([
    prisma.agency.findUnique({ where: { id: r.auth.agencyId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: r.auth.userId }, select: { name: true } }),
  ]);
  const emailSent = await sendTeamInviteEmail(invite, agency?.name ?? "l'agence", me?.name);
  return NextResponse.json({ invite: teamInviteView(invite), status: inviteStatus(invite), emailSent });
}
