import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { cleanLeadFields } from "@/lib/leadsText";
import { purgeExpiredLeads } from "@/lib/leads";
import { getContextFor } from "@/lib/contexts";

// Base de leads de l'utilisateur (ou du client dont l'agence ouvre l'espace).
const MAX_LEADS = 2000;

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  await purgeExpiredLeads().catch(() => {}); // aucune donnée LinkedIn périmée n'est jamais montrée
  // Les leads se lisent par thématique (la cible et le « bon lead » en dépendent) ; sans paramètre : ceux de la thématique du profil
  const rawCtx = new URL(req.url).searchParams.get("contextId");
  const ctx = rawCtx && rawCtx !== "main" ? await getContextFor(userId, rawCtx) : null;
  if (rawCtx && rawCtx !== "main" && !ctx) return NextResponse.json({ error: "Thématique introuvable." }, { status: 404 });
  const [leads, user, acc, contexts, counts] = await Promise.all([
    prisma.lead.findMany({ where: { userId, contextId: ctx ? ctx.id : null }, orderBy: { createdAt: "desc" }, take: MAX_LEADS }),
    prisma.user.findUnique({ where: { id: userId }, select: { leadIcp: true, targetAudience: true, companyName: true } }),
    prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgToken: true } }),
    prisma.context.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, kind: true } }),
    prisma.lead.groupBy({ by: ["contextId"], where: { userId }, _count: { _all: true } }),
  ]);
  const countOf = Object.fromEntries(counts.map((c) => [c.contextId ?? "main", c._count._all]));
  return NextResponse.json({
    leads,
    icp: (ctx ? ctx.leadIcp : user?.leadIcp) ?? "",
    target: (ctx ? ctx.targetAudience : user?.targetAudience) ?? "",
    pageConnected: Boolean(acc?.orgToken),
    scopes: [{ id: "main", name: user?.companyName || "Mon activité", kind: "activity", count: countOf.main ?? 0 }, ...contexts.map((c) => ({ ...c, count: countOf[c.id] ?? 0 }))],
  });
}

// Ajout à la main d'une personne
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const f = cleanLeadFields(raw);
  const ctxId = raw?.contextId && raw.contextId !== "main" ? (await getContextFor(userId, String(raw.contextId)))?.id ?? null : null;
  if (!f.name && !f.commentText) return NextResponse.json({ error: "Indiquez au moins un nom." }, { status: 400 });
  if ((await prisma.lead.count({ where: { userId } })) >= MAX_LEADS) return NextResponse.json({ error: "Base de leads pleine." }, { status: 409 });
  const lead = await prisma.lead.create({ data: { userId, source: "manual", ...f, contextId: ctxId } });
  return NextResponse.json({ lead }, { status: 201 });
}
