import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { inviteStatus } from "@/lib/invites";

// Public : vérifie un lien d'invitation à une équipe d'agence avant l'inscription (pré-remplit l'adresse invitée).
export async function GET(req, { params }) {
  if (!rateLimit(`team-invite:${clientIp(req)}`, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
  }
  const { token } = await params;
  const inv = /^[a-f0-9]{48}$/.test(token) ? await prisma.agencyInvite.findUnique({ where: { token }, include: { agency: { select: { name: true } } } }) : null;
  const status = inv ? inviteStatus(inv) : "invalid";
  if (status !== "pending") return NextResponse.json({ valid: false, status });
  return NextResponse.json({ valid: true, email: inv.email, agency: inv.agency.name });
}
