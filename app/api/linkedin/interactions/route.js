import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { summarizeInteractions } from "@/lib/interactions";

// GET : résumé des commentaires et réactions envoyés depuis LinkeePost (écran Statistiques)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const rows = await prisma.interactionLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(summarizeInteractions(rows));
}
