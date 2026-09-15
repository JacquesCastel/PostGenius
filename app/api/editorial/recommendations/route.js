import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { generateRecommendations } from "@/lib/editorial/recommendations";

// "Que publier ?" — recommandations éditoriales du copilote.
// GET : renvoie les recommandations actives, en générant une nouvelle
// fournée si aucune n'est disponible ou fraîche (voir FRESH_HOURS).
// ?force=1 : régénère même si des recommandations fraîches existent
// (bouton "Voir d'autres propositions").

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";

  try {
    const recommendations = await generateRecommendations(userId, { count: 3, force });
    return NextResponse.json({ recommendations });
  } catch (e) {
    console.error("Erreur recommandations éditoriales:", e);
    return NextResponse.json({ error: e.message || "Échec de la génération des recommandations." }, { status: 502 });
  }
}
