import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { respondToRecommendation } from "@/lib/editorial/recommendations";

// Feedback utilisateur sur une recommandation : générée / planifiée / ignorée / rejetée.
// Chaque appel est un signal persisté (status + respondedAt) pour affiner les
// prochaines recommandations (anti-répétition, équilibre des piliers).

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const { status, draftId } = await req.json();

  try {
    const reco = await respondToRecommendation(userId, id, { status, draftId });
    return NextResponse.json({ recommendation: reco });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Échec de la mise à jour." }, { status: 400 });
  }
}
