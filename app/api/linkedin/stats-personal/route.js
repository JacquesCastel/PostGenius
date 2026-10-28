import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { captureProfileStats, utcDay } from "@/lib/linkedin/profileStats";

// Statistiques du profil personnel — API officielle LinkedIn memberCreatorPostAnalytics (permission r_member_postAnalytics, app dédiée
// « PostGenius Stats », jeton statsToken). Cet écran ne lit PAS LinkedIn : il affiche le dernier relevé enregistré. LinkedIn n'est interrogé
// qu'une fois par jour et par compte (relevé quotidien du planificateur, voir lib/editorial/statSnapshots.js), car le quota du palier
// « Development » (environ 100 appels par jour et par membre) ne permet pas d'appeler à chaque affichage. Seul le tout premier affichage,
// quand aucun relevé n'existe encore, déclenche la lecture du jour.
// Doc : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { statsToken: true, statsExpiresAt: true } });
  if (!decryptToken(acc?.statsToken)) return NextResponse.json({ connected: false });
  if (acc.statsExpiresAt && acc.statsExpiresAt < new Date()) {
    return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez les statistiques du profil (menu « Connexions »)." }, { status: 401 });
  }

  let snap = await prisma.statSnapshot.findFirst({ where: { userId, detailed: true }, orderBy: { day: "desc" } });
  if (!snap) {
    const r = await captureProfileStats(userId);
    if (r.snapshot) snap = r.snapshot;
    else if (r.status === 403) return NextResponse.json({ error: "LinkedIn refuse l'accès aux statistiques (permission r_member_postAnalytics pas encore approuvée — en attente de revue LinkedIn)." }, { status: 403 });
    else if (r.status === 401) return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez les statistiques du profil (menu « Connexions »)." }, { status: 401 });
    else if (r.status === 429) return NextResponse.json({ connected: true, noData: true, quotaLimited: true, aggregate: {}, posts: [] });
    else return NextResponse.json({ error: "Échec de la récupération des statistiques." }, { status: 500 });
  }
  const body = snap.body ?? {};
  return NextResponse.json({ connected: true, aggregate: body.aggregate ?? {}, posts: body.posts ?? [], asOf: snap.createdAt, day: snap.day, stale: snap.day !== utcDay() });
}
