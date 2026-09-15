import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getPillars } from "@/lib/editorial/pillars";

// Piliers éditoriaux du client (semés avec des valeurs par défaut au premier appel).

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const pillars = await getPillars(userId);
  return NextResponse.json({ pillars });
}
