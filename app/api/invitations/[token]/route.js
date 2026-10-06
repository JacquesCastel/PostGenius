import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { inviteStatus, INVITE_PLAN, INVITE_ACCESS_DAYS } from "@/lib/invites";
import { PLANS } from "@/lib/plans";

// Public : vérifie un lien d'invitation avant l'inscription (pré-remplit l'adresse invitée).
// Ne révèle rien d'autre que l'adresse de la personne qui détient le lien.

export async function GET(req, { params }) {
  if (!rateLimit(`invite:${clientIp(req)}`, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
  }
  const { token } = await params;
  const inv = /^[a-f0-9]{48}$/.test(token) ? await prisma.invitation.findUnique({ where: { token } }) : null;
  const status = inv ? inviteStatus(inv) : "invalid";
  if (status !== "pending") return NextResponse.json({ valid: false, status });
  return NextResponse.json({
    valid: true,
    email: inv.email,
    planName: PLANS[INVITE_PLAN].name,
    accessDays: INVITE_ACCESS_DAYS,
  });
}
