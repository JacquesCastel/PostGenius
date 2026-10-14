import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { PLANS, PLAN_IDS } from "@/lib/plans";
import { QUOTA_KEYS, CODE_LIMITS, cleanQuotaInput, planLimits, forgetPlanConfigs } from "@/lib/quotas";

// Limites des offres, modifiables depuis l'administration. Les prix et les fonctions incluses restent dans le code (ils sont liés à Stripe).
// GET : { plans: [{ id, name, price, code, effective }] } — code = valeurs d'origine, effective = valeurs appliquées.
// PUT { planId, limits } : limits = { postsPerMonth, imagesPerMonth, knowledgeSources } ; valeur vide = valeur d'origine ; -1 = illimité.
export async function GET(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const plans = await Promise.all(PLAN_IDS.map(async (id) => ({ id, name: PLANS[id].name, price: PLANS[id].price, code: CODE_LIMITS[id], effective: await planLimits(id) })));
  return NextResponse.json({ plans, keys: QUOTA_KEYS });
}

export async function PUT(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!PLAN_IDS.includes(body.planId)) return NextResponse.json({ error: "Offre inconnue." }, { status: 400 });
  const limits = cleanQuotaInput(body.limits);
  if (Object.keys(limits).length) {
    await prisma.planConfig.upsert({ where: { planId: body.planId }, create: { planId: body.planId, limits }, update: { limits } });
  } else {
    await prisma.planConfig.deleteMany({ where: { planId: body.planId } });
  }
  forgetPlanConfigs();
  return NextResponse.json({ ok: true, effective: await planLimits(body.planId) });
}
