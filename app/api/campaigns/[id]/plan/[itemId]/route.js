import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { updateItem, deleteItem, PlanError } from "@/lib/campaignPlanStore";

const fail = (e) => NextResponse.json({ error: e.message, ...(e.extra ?? {}) }, { status: e instanceof PlanError ? e.status : 500 });

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id, itemId } = await params;
  try {
    return NextResponse.json({ item: await updateItem(userId, id, itemId, await req.json().catch(() => ({}))) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id, itemId } = await params;
  try {
    await deleteItem(userId, id, itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
