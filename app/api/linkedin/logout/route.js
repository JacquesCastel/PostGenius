import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// Déconnecte les comptes LinkedIn du client (efface les tokens en base)
export async function POST(req) {
  const userId = await getUserId(req);
  if (userId) {
    await prisma.linkedInAccount.deleteMany({ where: { userId } });
  }
  return NextResponse.json({ ok: true });
}
