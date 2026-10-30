import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { coachFor } from "@/lib/coachData";
import { logActiveOncePerDay } from "@/lib/activity";

// « Le coach » : ce qui marche le mieux chez vous, d'après les mesures déjà enregistrées de vos posts (aucun appel à LinkedIn, aucune IA).
// scope=profile (posts du profil), scope=page&org=urn:li:organization:… (posts de cette page) ou scope=all (tout, pour les créneaux conseillés).

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";
  const org = searchParams.get("org");
  if (scope === "page" && !/^urn:li:organization:\d+$/.test(org ?? "")) return NextResponse.json({ error: "Paramètre org invalide." }, { status: 400 });
  void logActiveOncePerDay(userId, "coach");
  return NextResponse.json(await coachFor(userId, { scope, org }));
}
