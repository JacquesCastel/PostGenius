import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// Renvoie le compte Instagram connecté (ou null).
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ account: null });

  const account = await prisma.instagramAccount.findUnique({
    where: { userId },
    select: { igUserId: true, igUsername: true, igName: true, igPicture: true },
  });
  return NextResponse.json({ account: account ?? null });
}
