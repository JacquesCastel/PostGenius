import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { validateItem, PlanError } from "@/lib/campaignPlanStore";

// Valide une publication du plan (programmée à la date proposée) ou annule la validation.
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id, itemId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await validateItem(userId, id, itemId, body.validated !== false);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e instanceof PlanError ? e.status : 500 });
  }
}
