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

// GET /api/agency/queue — posts à traiter (à valider, en erreur) de tous les clients
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const drafts = await prisma.draft.findMany({
      where: {
        status: { in: ["à valider", "erreur"] },
        user: { managedByUserId: auth.userId },
      },
      select: {
        id: true, status: true, text: true, type: true, imageUrl: true,
        scheduledAt: true, publishError: true, createdAt: true,
        campaign: { select: { name: true } },
        user: { select: { id: true, name: true, companyName: true, linkedin: { select: { personName: true } } } },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 300,
    });
    const items = drafts.map((d) => ({
      id: d.id, status: d.status, text: d.text, type: d.type, imageUrl: d.imageUrl,
      scheduledAt: d.scheduledAt, publishError: d.publishError, createdAt: d.createdAt,
      campaign: d.campaign,
      client: {
        id: d.user.id, name: d.user.name, companyName: d.user.companyName,
        linkedinConnected: Boolean(d.user.linkedin?.personName),
      },
    }));
    return NextResponse.json({
      items,
      toValidateCount: items.filter((i) => i.status === "à valider").length,
      errorCount: items.filter((i) => i.status === "erreur").length,
    });
  } catch (e) {
    console.error("GET /api/agency/queue:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
