import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { quotaStatus } from "@/lib/quotas";

// GET — consommation du mois et limites du compte dont on voit les données (le client ouvert en mode agence)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  return NextResponse.json(await quotaStatus(userId));
}
