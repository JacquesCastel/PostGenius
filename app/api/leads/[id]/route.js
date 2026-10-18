import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { cleanLeadFields } from "@/lib/leadsText";

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, userId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
  const f = cleanLeadFields(await req.json().catch(() => ({})));
  // Une identité corrigée à la main change ce que l'IA sait : la note est à refaire
  const data = "name" in f || "headline" in f || "company" in f ? { ...f, level: null, reason: null, scoredAt: null } : f;
  return NextResponse.json({ lead: await prisma.lead.update({ where: { id }, data }) });
}

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const r = await prisma.lead.deleteMany({ where: { id, userId } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
}
