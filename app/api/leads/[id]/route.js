import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { cleanLeadFields, isLinkedInLead } from "@/lib/leadsText";
import { getContextFor } from "@/lib/contexts";

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, userId }, select: { id: true, source: true } });
  if (!lead) return NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
  const raw = await req.json().catch(() => ({}));
  const f = cleanLeadFields(raw);
  // Changer de thématique : la note dépendait des critères de l'ancienne, elle est à refaire
  if ("contextId" in raw) {
    const target = raw.contextId && raw.contextId !== "main" ? await getContextFor(userId, String(raw.contextId)) : null;
    if (raw.contextId && raw.contextId !== "main" && !target) return NextResponse.json({ error: "Thématique introuvable." }, { status: 404 });
    Object.assign(f, { contextId: target ? target.id : null, level: null, reason: null, scoredAt: null });
  }
  // Un lead issu de LinkedIn : seuls le statut et la note se modifient (on ne complète pas à la main des données de membre)
  if (isLinkedInLead(lead)) for (const k of ["name", "headline", "company", "profileUrl", "commentText"]) delete f[k];
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
