import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// Compteurs d'activité qui alimentent la « prochaine étape recommandée » (voir lib/nextSteps.js) :
// posts écrits et publiés, sources, remarques, suggestions en attente, connexion LinkedIn. Lecture seule.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const [draftCount, publishedCount, knowledgeCount, remarksCount, pendingSuggestions, acc] = await Promise.all([
    prisma.draft.count({ where: { userId } }),
    prisma.draft.count({ where: { userId, status: "publié" } }),
    prisma.knowledgeSource.count({ where: { userId } }),
    prisma.postRemark.count({ where: { userId } }),
    prisma.remarkSuggestion.count({ where: { userId, status: "proposée" } }),
    prisma.linkedInAccount.findUnique({ where: { userId }, select: { personToken: true, personExpiresAt: true } }),
  ]);
  // Même règle que /api/linkedin/me : jeton présent et non expiré
  const linkedinConnected = Boolean(acc?.personToken && (!acc.personExpiresAt || acc.personExpiresAt > new Date()));
  return NextResponse.json({ draftCount, publishedCount, knowledgeCount, remarksCount, pendingSuggestions, linkedinConnected });
}
