import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, MAX_AGENCY_MEMBERS } from "@/lib/agency";
import { seatsUsed, createTeamInvite, teamInviteView, sendTeamInviteEmail } from "@/lib/agencyTeam";
import { isEmail, normalizeEmail } from "@/lib/invites";

// GET : l'équipe de l'agence (tous les utilisateurs de l'agence la voient) ; POST : inviter un collaborateur (propriétaire)
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [members, invites, agency] = await Promise.all([
    prisma.agencyMember.findMany({ where: { agencyId: auth.agencyId }, orderBy: { createdAt: "asc" }, select: { userId: true, role: true, createdAt: true, user: { select: { name: true, email: true } } } }),
    prisma.agencyInvite.findMany({ where: { agencyId: auth.agencyId, acceptedAt: null, revokedAt: null }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.agency.findUnique({ where: { id: auth.agencyId }, select: { name: true } }),
  ]);
  return NextResponse.json({
    agency: agency?.name ?? "",
    me: { userId: auth.userId, role: auth.role },
    max: MAX_AGENCY_MEMBERS,
    members: members.map((m) => ({ userId: m.userId, role: m.role, name: m.user.name, email: m.user.email, since: m.createdAt })),
    invites: invites.map(teamInviteView).filter((i) => i.status === "pending"),
  });
}

export async function POST(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role !== "owner") return NextResponse.json({ error: "Seul le propriétaire de l'agence peut inviter un collaborateur." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (!isEmail(body.email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  const email = normalizeEmail(body.email);
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "Un compte existe déjà avec cette adresse : la personne doit utiliser une autre adresse." }, { status: 409 });
  }
  // Une relance de la même adresse ne prend pas de place en plus
  const again = await prisma.agencyInvite.count({ where: { agencyId: auth.agencyId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
  if (!again && (await seatsUsed(auth.agencyId)) >= MAX_AGENCY_MEMBERS) {
    return NextResponse.json({ error: `Votre agence compte déjà ${MAX_AGENCY_MEMBERS} utilisateurs (invitations en attente comprises). Au-delà, contactez-nous.`, code: "seats_limit" }, { status: 403 });
  }
  const [agency, me] = await Promise.all([
    prisma.agency.findUnique({ where: { id: auth.agencyId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
  ]);
  const invite = await createTeamInvite(auth.agencyId, email, auth.userId);
  const emailSent = await sendTeamInviteEmail(invite, agency?.name ?? "l'agence", me?.name);
  return NextResponse.json({ invite: teamInviteView(invite), emailSent }, { status: 201 });
}
