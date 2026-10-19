import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { cleanLeadFields } from "@/lib/leadsText";
import { purgeExpiredLeads } from "@/lib/leads";

// Base de leads de l'utilisateur (ou du client dont l'agence ouvre l'espace).
const MAX_LEADS = 2000;

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  await purgeExpiredLeads().catch(() => {}); // aucune donnée LinkedIn périmée n'est jamais montrée
  const [leads, user, acc] = await Promise.all([
    prisma.lead.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: MAX_LEADS }),
    prisma.user.findUnique({ where: { id: userId }, select: { leadIcp: true, targetAudience: true } }),
    prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgToken: true } }),
  ]);
  return NextResponse.json({ leads, icp: user?.leadIcp ?? "", target: user?.targetAudience ?? "", pageConnected: Boolean(acc?.orgToken) });
}

// Ajout à la main d'une personne
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  const f = cleanLeadFields(await req.json().catch(() => ({})));
  if (!f.name && !f.commentText) return NextResponse.json({ error: "Indiquez au moins un nom." }, { status: 400 });
  if ((await prisma.lead.count({ where: { userId } })) >= MAX_LEADS) return NextResponse.json({ error: "Base de leads pleine." }, { status: 409 });
  const lead = await prisma.lead.create({ data: { userId, source: "manual", ...f } });
  return NextResponse.json({ lead }, { status: 201 });
}
