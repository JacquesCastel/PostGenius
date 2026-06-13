import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { planCampaignForUser } from "@/lib/campaign";
import { checkFeature } from "@/lib/gating";

// Planifie la création automatique de posts sur les créneaux du rythme
// de publication, pour la période demandée.

export const maxDuration = 300; // plusieurs appels IA séquentiels

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const feat = await checkFeature(userId, "campaigns", "L'outil de campagne");
  if (!feat.ok) return NextResponse.json({ error: feat.error }, { status: 403 });

  const { periodDays, themes, target, campaignId } = await req.json();
  if (target && target !== "person" && !/^urn:li:organization:\d+$/.test(target)) {
    return NextResponse.json({ error: "Compte de publication invalide." }, { status: 400 });
  }

  try {
    const result = await planCampaignForUser(userId, {
      periodDays: [7, 14, 30].includes(periodDays) ? periodDays : 7,
      themes,
      target: target || "person",
      campaignId,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("Erreur plan campagne:", e);
    return NextResponse.json({ error: e.message || "Échec de la planification." }, { status: 500 });
  }
}
