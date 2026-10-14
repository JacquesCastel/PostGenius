import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { cleanQuotaInput, quotaStatus, planLimits } from "@/lib/quotas";

// Limites propres à un compte (administrateur) : GET { limits, usage, overrides, plan } ; PUT { postsPerMonth?, imagesPerMonth?, knowledgeSources? }
// Valeur vide = limite de l'offre ; -1 = illimité.
async function target(req, params) {
  if (!(await requireAdmin(req))) return { res: NextResponse.json({ error: "Accès refusé." }, { status: 403 }) };
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, plan: true, quotaOverrides: true } });
  if (!u) return { res: NextResponse.json({ error: "Compte introuvable." }, { status: 404 }) };
  return { u };
}

export async function GET(req, { params }) {
  const t = await target(req, params);
  if (t.res) return t.res;
  const [status, plan] = await Promise.all([quotaStatus(t.u.id), planLimits(t.u.plan)]);
  return NextResponse.json({ ...status, overrides: t.u.quotaOverrides ?? {}, plan });
}

export async function PUT(req, { params }) {
  const t = await target(req, params);
  if (t.res) return t.res;
  const next = cleanQuotaInput(await req.json().catch(() => ({})));
  const overrides = Object.keys(next).length ? next : null;
  await prisma.user.update({ where: { id: t.u.id }, data: { quotaOverrides: overrides ?? Prisma.DbNull } });
  const [status, plan] = await Promise.all([quotaStatus(t.u.id), planLimits(t.u.plan)]);
  return NextResponse.json({ ...status, overrides: overrides ?? {}, plan });
}
