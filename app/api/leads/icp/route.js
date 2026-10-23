import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { cleanIcp } from "@/lib/leadsText";
import { getContextFor } from "@/lib/contexts";

// Client idéal : texte libre, utilisé pour noter les leads. Propre à une thématique si `contextId` est donné, sinon celui du profil.
export async function PUT(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { icp, contextId } = await req.json().catch(() => ({}));
  const value = cleanIcp(icp);
  if (contextId && contextId !== "main") {
    const ctx = await getContextFor(userId, String(contextId));
    if (!ctx) return NextResponse.json({ error: "Thématique introuvable." }, { status: 404 });
    await prisma.context.update({ where: { id: ctx.id }, data: { leadIcp: value || null } });
    return NextResponse.json({ icp: value });
  }
  await prisma.user.update({ where: { id: userId }, data: { leadIcp: value || null } });
  return NextResponse.json({ icp: value });
}
