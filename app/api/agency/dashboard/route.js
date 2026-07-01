import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

async function requireAgency(req) {
  const userId = await getUserId(req);
  if (!userId) return { error: "Non connecté", status: 401 };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!user) return { error: "Utilisateur introuvable", status: 404 };
  if (user.plan !== "agence") return { error: "Réservé au plan Agence", status: 403 };
  return { userId };
}

// Calcule le % de complétion du profil et la liste des champs manquants
function computeCompletion(client) {
  const checks = [
    { key: "headline",            label: "Titre LinkedIn" },
    { key: "businessDescription", label: "Description activité" },
    { key: "targetAudience",      label: "Audience cible" },
    { key: "themes",              label: "Thèmes de contenu" },
    { key: "styleNotes",          label: "Style de rédaction" },
  ];
  const linkedIn = Boolean(client.linkedin?.personName);
  const total = checks.length + 1; // +1 pour LinkedIn
  const missing = checks.filter((c) => !client[c.key]?.trim()).map((c) => c.label);
  if (!linkedIn) missing.push("LinkedIn non connecté");
  const done = total - missing.length;
  return { percent: Math.round((done / total) * 100), missing };
}

// GET /api/agency/dashboard — tableau de bord agrégé pour tous les clients de l'agence
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const clients = await prisma.user.findMany({
      where: { managedByUserId: auth.userId },
      select: {
        id: true, name: true, email: true, companyName: true,
        headline: true, businessDescription: true, targetAudience: true,
        themes: true, styleNotes: true, tone: true,
        linkedin: { select: { personName: true, orgName: true } },
        drafts: {
          select: {
            id: true, status: true, type: true,
            text: true, publishedAt: true, scheduledAt: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = clients.map((client) => {
      const { drafts, ...data } = client;

      const pending   = drafts.filter((d) => d.status === "brouillon");
      const scheduled = drafts.filter((d) => d.status === "programmé");
      const published = drafts.filter((d) => d.status === "publié");
      const lastPub   = published[0] ?? null;

      return {
        ...data,
        completion: computeCompletion(client),
        pendingCount:   pending.length,
        scheduledCount: scheduled.length,
        totalPosts:     published.length,
        // 5 brouillons les plus récents pour le panel
        pendingDrafts: pending.slice(0, 5).map((d) => ({
          id: d.id,
          type: d.type,
          text: d.text?.slice(0, 180) ?? "",
          createdAt: d.createdAt,
        })),
        lastPublished: lastPub ? {
          text: lastPub.text?.slice(0, 120) ?? "",
          publishedAt: lastPub.publishedAt,
        } : null,
      };
    });

    return NextResponse.json({ clients: result });
  } catch (e) {
    console.error("GET /api/agency/dashboard:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
