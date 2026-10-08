import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, limitBody } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { generateItem, PlanError } from "@/lib/campaignPlanStore";

// Rédige une publication du plan (un appel par publication : le client enchaîne). Le post reste « à valider ».
export const maxDuration = 120;

export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const feat = await checkFeature(userId, "campaigns", "L'outil de campagne");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  if (!rateLimit(`plan-generate:${userId}`, { limit: 60, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop de rédactions pour l'instant. Réessayez dans quelques minutes." }, { status: 429 });
  }
  const { id, itemId } = await params;
  try {
    return NextResponse.json({ item: await generateItem(userId, id, itemId) });
  } catch (e) {
    if (!(e instanceof PlanError)) console.error("Erreur rédaction du plan:", e);
    return NextResponse.json({ error: e instanceof PlanError ? e.message : "Échec de la rédaction.", ...(e.extra ?? {}) }, { status: e instanceof PlanError ? e.status : 500 });
  }
}
