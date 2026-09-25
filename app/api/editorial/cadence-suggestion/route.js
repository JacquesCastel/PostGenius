import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getSuggestedSlot } from "@/lib/editorial/cadence";

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const suggestion = await getSuggestedSlot(userId);
  return NextResponse.json({ suggestion });
}
