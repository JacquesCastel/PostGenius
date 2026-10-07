import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature } from "@/lib/gating";

// Compteurs d'activité qui alimentent la « prochaine étape recommandée » (voir lib/nextSteps.js) :
// posts écrits et publiés, sources, remarques, suggestions en attente, connexion LinkedIn, charte graphique,
// événements (et accès à ce module selon l'offre). Lecture seule.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const [draftCount, publishedCount, knowledgeCount, remarksCount, pendingSuggestions, acc, brandKit, eventCount, events, campaignCount, campaigns] = await Promise.all([
    prisma.draft.count({ where: { userId } }),
    prisma.draft.count({ where: { userId, status: "publié" } }),
    prisma.knowledgeSource.count({ where: { userId } }),
    prisma.postRemark.count({ where: { userId } }),
    prisma.remarkSuggestion.count({ where: { userId, status: "proposée" } }),
    prisma.linkedInAccount.findUnique({ where: { userId }, select: { personToken: true, personExpiresAt: true } }),
    prisma.brandKit.findUnique({ where: { userId }, select: { id: true } }),
    prisma.event.count({ where: { userId } }),
    checkFeature(userId, "events", "Le module Événements"),
    prisma.campaign.count({ where: { userId } }),
    checkFeature(userId, "campaigns", "L'outil de campagne"),
  ]);
  // Même règle que /api/linkedin/me : jeton présent et non expiré
  const linkedinConnected = Boolean(acc?.personToken && (!acc.personExpiresAt || acc.personExpiresAt > new Date()));
  return NextResponse.json({ draftCount, publishedCount, knowledgeCount, remarksCount, pendingSuggestions, linkedinConnected, hasBrandKit: Boolean(brandKit), eventCount, canEvents: events.ok, campaignCount, canCampaigns: campaigns.ok });
}
