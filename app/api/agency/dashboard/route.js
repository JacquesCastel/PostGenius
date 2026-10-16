import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, clientScope } from "@/lib/agency";


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
      where: clientScope(auth),
      select: {
        id: true, name: true, email: true, companyName: true, onboardedAt: true,
        headline: true, businessDescription: true, targetAudience: true,
        themes: true, styleNotes: true, tone: true,
        linkedin: { select: { personName: true, orgName: true } },
        accessAsClient: { select: { memberId: true } },
        personalProfile: true,
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
      const { drafts, onboardedAt, accessAsClient, ...data } = client;

      const pending   = drafts.filter((d) => d.status === "brouillon");
      const scheduled = drafts.filter((d) => d.status === "programmé");
      const published = drafts.filter((d) => d.status === "publié");
      const toValidate = drafts.filter((d) => d.status === "à valider");
      const errors     = drafts.filter((d) => d.status === "erreur");
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const publishedThisMonth = published.filter((d) => d.publishedAt && d.publishedAt >= monthStart).length;
      const lastPub   = published[0] ?? null;

      return {
        ...data,
        onboarded: Boolean(onboardedAt), // false : configuration guidée à terminer
        assignees: accessAsClient.map((a) => a.memberId), // équipiers affectés à ce client
        completion: computeCompletion(client),
        pendingCount:   pending.length,
        scheduledCount: scheduled.length,
        toValidateCount: toValidate.length,
        errorCount:      errors.length,
        publishedThisMonth,
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

    // Équipe (pour afficher les noms des équipiers affectés) et réglage de cloisonnement
    const [members, ag] = await Promise.all([
      prisma.agencyMember.findMany({ where: { agencyId: auth.agencyId }, select: { role: true, user: { select: { id: true, name: true, email: true } } } }),
      prisma.agency.findUnique({ where: { id: auth.agencyId }, select: { restrictClients: true } }),
    ]);
    return NextResponse.json({
      clients: result,
      members: members.map((m) => ({ id: m.user.id, name: m.user.name || m.user.email, role: m.role })),
      restrict: Boolean(ag?.restrictClients),
    });
  } catch (e) {
    console.error("GET /api/agency/dashboard:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
