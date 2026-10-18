import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { cleanIcp } from "@/lib/leadsText";

// Client idéal : texte libre, utilisé pour noter les leads.
export async function PUT(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { icp } = await req.json().catch(() => ({}));
  const value = cleanIcp(icp);
  await prisma.user.update({ where: { id: userId }, data: { leadIcp: value || null } });
  return NextResponse.json({ icp: value });
}
