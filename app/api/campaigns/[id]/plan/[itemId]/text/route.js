import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { updateItemText, PlanError } from "@/lib/campaignPlanStore";

// Retouche du texte rédigé d'une publication du plan.
export async function PUT(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id, itemId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await updateItemText(userId, id, itemId, body.text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e instanceof PlanError ? e.status : 500 });
  }
}
