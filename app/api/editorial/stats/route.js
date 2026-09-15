import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getEditorialStats } from "@/lib/editorial/stats";
import { getAutopilotStatus } from "@/lib/editorial/autopilot";

// Indicateurs de transparence du copilote éditorial (page "Copilote IA") :
// taux d'acceptation, poids appris par pilier/format, historique récent,
// statut de l'autopilot.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const stats = await getEditorialStats(userId);
  return NextResponse.json({ ...stats, autopilot: getAutopilotStatus() });
}
