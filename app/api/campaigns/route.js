import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature } from "@/lib/gating";
import { normalizeMood } from "@/lib/moods";
import { getContextFor } from "@/lib/contexts";

// Campagnes LinkedIn du client

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("all") === "1";

  const campaigns = await prisma.campaign.findMany({
    where: { userId, ...(includeArchived ? {} : { status: "active" }) },
    orderBy: { createdAt: "desc" },
    include: {
      drafts: { select: { status: true, scheduledAt: true, publishedAt: true } },
      company: { select: { name: true } },
    },
  });

  const now = new Date();
  return NextResponse.json({
    campaigns: campaigns.map((c) => {
      const byStatus = {};
      for (const d of c.drafts) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      const next = c.drafts
        .filter((d) => (d.status === "programmé" || d.status === "à valider") && d.scheduledAt > now)
        .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
      return {
        id: c.id,
        name: c.name,
        theme: c.theme,
        objective: c.objective,
        context: c.context,
        mood: c.mood,
        status: c.status,
        contextId: c.contextId,
        contextName: c.company?.name ?? null,
        createdAt: c.createdAt,
        postCount: c.drafts.length,
        published: byStatus["publié"] ?? 0,
        scheduled: byStatus["programmé"] ?? 0,
        toValidate: byStatus["à valider"] ?? 0,
        errors: byStatus["erreur"] ?? 0,
        nextScheduledAt: next?.scheduledAt ?? null,
      };
    }),
  });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const feat = await checkFeature(userId, "campaigns", "L'outil de campagne");
  if (!feat.ok) return NextResponse.json({ error: feat.error }, { status: 403 });

  const { name, theme, objective, context, mood, contextId } = await req.json();
  if (!theme?.trim()) return NextResponse.json({ error: "Thème requis." }, { status: 400 });
  // Entreprise de la campagne (facultatif ; nul = entreprise principale)
  let ownContextId = null;
  if (contextId) {
    const own = await getContextFor(userId, contextId);
    if (!own) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 400 });
    ownContextId = own.id;
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId,
      name: name?.trim() || theme.trim().slice(0, 60),
      theme: theme.trim(),
      objective: objective?.trim() || null,
      context: context?.trim() || null,
      mood: normalizeMood(mood),
      contextId: ownContextId,
    },
  });
  return NextResponse.json({ campaign });
}
