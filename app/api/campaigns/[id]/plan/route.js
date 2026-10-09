import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, limitBody } from "@/lib/gating";
import { getPlan, approveVoices, addItem, shiftItems, mapAccount, ensurePlanFromBrief, PlanError } from "@/lib/campaignPlanStore";

// Plan éditorial d'une campagne : lecture (GET) et actions (POST : add, shift, map, import).
const fail = (e) => NextResponse.json({ error: e.message, ...(e.extra ?? {}) }, { status: e instanceof PlanError ? e.status : 500 });

export async function GET(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await getPlan(userId, id));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const feat = await checkFeature(userId, "campaigns", "L'outil de campagne");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "add") await addItem(userId, id, body.item ?? {});
    else if (body.action === "shift") await shiftItems(userId, id, body.start);
    else if (body.action === "map") await mapAccount(userId, id, { account: body.account, target: body.target });
    else if (body.action === "import") await ensurePlanFromBrief(userId, id);
    else if (body.action === "approveVoices") await approveVoices(userId, id, body.approved !== false);
    else return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    return NextResponse.json(await getPlan(userId, id));
  } catch (e) {
    return fail(e);
  }
}
