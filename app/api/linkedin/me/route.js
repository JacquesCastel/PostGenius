import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// Statut des connexions LinkedIn du client (lu en base)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ connected: false, orgConnected: false });

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const now = new Date();
  const personValid = acc?.personToken && (!acc.personExpiresAt || acc.personExpiresAt > now);
  const orgValid = acc?.orgToken && (!acc.orgExpiresAt || acc.orgExpiresAt > now);

  return NextResponse.json({
    connected: Boolean(personValid),
    name: personValid ? acc.personName ?? "" : "",
    personExpiresAt: personValid ? acc.personExpiresAt : null,
    orgConnected: Boolean(orgValid),
    orgExpiresAt: orgValid ? acc.orgExpiresAt : null,
  });
}
