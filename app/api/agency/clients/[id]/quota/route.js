import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency, ownClient } from "@/lib/agency";
import { cleanQuotaInput, quotaStatus, planLimits } from "@/lib/quotas";

// Quotas d'un client d'agence — réservé au propriétaire de l'agence.
// GET : { limits (effectives), usage, overrides (réglages de ce client), plan (limites de l'offre) }
// PUT { postsPerMonth?, imagesPerMonth?, knowledgeSources? } : fixe ou — avec une valeur vide — retire une limite propre au client.
async function guard(req, params) {
  const auth = await requireAgency(req);
  if (auth.error) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.role !== "owner") return { res: NextResponse.json({ error: "Seul le propriétaire de l'agence règle les quotas des clients." }, { status: 403 }) };
  const { id } = await params;
  const client = await ownClient(auth, id, { id: true, plan: true, quotaOverrides: true });
  if (!client) return { res: NextResponse.json({ error: "Client introuvable" }, { status: 404 }) };
  return { client };
}

export async function GET(req, { params }) {
  const g = await guard(req, params);
  if (g.res) return g.res;
  const [status, plan] = await Promise.all([quotaStatus(g.client.id), planLimits(g.client.plan)]);
  return NextResponse.json({ ...status, overrides: g.client.quotaOverrides ?? {}, plan });
}

export async function PUT(req, { params }) {
  const g = await guard(req, params);
  if (g.res) return g.res;
  const body = await req.json().catch(() => ({}));
  const next = cleanQuotaInput(body);
  const overrides = Object.keys(next).length ? next : null;
  await prisma.user.update({ where: { id: g.client.id }, data: { quotaOverrides: overrides ?? Prisma.DbNull } });
  const [status, plan] = await Promise.all([quotaStatus(g.client.id), planLimits(g.client.plan)]);
  return NextResponse.json({ ...status, overrides: overrides ?? {}, plan });
}
