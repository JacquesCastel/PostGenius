import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, limitBody } from "@/lib/gating";
import { normalizeMood } from "@/lib/moods";
import { getContextFor } from "@/lib/contexts";
import { ensurePlanFromBrief } from "@/lib/campaignPlanStore";
import { normalizeBrief, compileBriefContext, briefStats, parseBrief } from "@/lib/campaignBrief";

// Campagnes LinkedIn du client

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("all") === "1";

  const campaigns = await prisma.campaign.findMany({
    where: { userId, status: includeArchived ? { not: "brouillon" } : "active" },
    orderBy: { createdAt: "desc" },
    include: {
      drafts: { select: { status: true, scheduledAt: true, publishedAt: true } },
      plan: { select: { status: true } },
      company: { select: { name: true } },
    },
  });

  // Créations en cours : reprises là où on les a laissées
  const drafts = includeArchived ? [] : await prisma.campaign.findMany({ where: { userId, status: "brouillon" }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, name: true, draftState: true, updatedAt: true } });
  const now = new Date();
  return NextResponse.json({
    drafts: drafts.map((d) => { let state = null; try { state = JSON.parse(d.draftState ?? "null"); } catch {} return { id: d.id, name: d.name, kind: state?.kind ?? "wizard", updatedAt: d.updatedAt, state: state?.state ?? null }; }),
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
        briefStats: briefStats(parseBrief(c.brief)),
        planStats: c.plan.length ? { total: c.plan.length, generated: c.plan.filter((p) => p.status === "généré").length } : null,
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
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });

  const body = await req.json();
  // Brief importé d'un document : on le re-valide côté serveur et on en tire le texte transmis à chaque rédaction
  const brief = body.brief ? normalizeBrief(body.brief) : null;
  const { contextId } = body;
  const name = body.name || brief?.name;
  const theme = body.theme || brief?.theme;
  const objective = body.objective ?? brief?.objective;
  const context = brief ? compileBriefContext(brief) : body.context;
  const mood = body.mood ?? brief?.mood;
  if (!theme?.trim()) return NextResponse.json({ error: "Thème requis." }, { status: 400 });
  // Entreprise de la campagne (facultatif ; nul = entreprise principale)
  let ownContextId = null;
  if (contextId) {
    const own = await getContextFor(userId, contextId);
    if (!own) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 400 });
    ownContextId = own.id;
  }

  const data = {
      userId,
      name: name?.trim() || theme.trim().slice(0, 60),
      theme: theme.trim(),
      objective: objective?.trim() || null,
      context: context?.trim() || null,
      brief: brief ? JSON.stringify(brief) : null,
      mood: normalizeMood(mood),
      contextId: ownContextId,
  };
  // Création reprise d'un brouillon : le brouillon devient la campagne (même identifiant), son état de travail est effacé
  let campaign;
  const draft = body.draftId ? await prisma.campaign.findFirst({ where: { id: String(body.draftId), userId, status: "brouillon" }, select: { id: true } }) : null;
  if (draft) campaign = await prisma.campaign.update({ where: { id: draft.id }, data: { ...data, status: "active", draftState: null } });
  else campaign = await prisma.campaign.create({ data });
  // Brief importé avec un calendrier : le plan éditorial est préparé (à relire dans la campagne)
  let planned = 0;
  if (brief?.calendar?.length) planned = await ensurePlanFromBrief(userId, campaign.id).catch(() => 0);
  return NextResponse.json({ campaign, planned });
}
