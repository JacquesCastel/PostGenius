import { NextResponse } from "next/server";
import { runDuePublications } from "@/lib/scheduler";

// Publication des posts programmés arrivés à échéance.
// En production (Vercel) : appelé par Vercel Cron (voir vercel.json).
// Protégé par CRON_SECRET si défini (Vercel l'envoie en Authorization: Bearer).

export const dynamic = "force-dynamic";

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const results = await runDuePublications();
  return NextResponse.json(results);
}
