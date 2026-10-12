import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, clientScope } from "@/lib/agency";
import { checkFeature, limitBody } from "@/lib/gating";
import { getMonthlyReport } from "@/lib/reports/monthly";

// GET /api/agency/followup?year=&month= — suivi du mois, une ligne par client (publiés, validés par le client, en attente, programmés)
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const gate = await checkFeature(auth.userId, "orgStats", "Le suivi par client");
  if (!gate.ok) return NextResponse.json(limitBody(gate), { status: 403 });

  const now = new Date();
  const sp = new URL(req.url).searchParams;
  const year = Number(sp.get("year")) || now.getFullYear();
  const month = Number(sp.get("month")) || now.getMonth() + 1;
  if (month < 1 || month > 12) return NextResponse.json({ error: "Mois invalide." }, { status: 400 });

  const clients = await prisma.user.findMany({ where: clientScope(auth), select: { id: true, name: true, companyName: true }, orderBy: { createdAt: "asc" } });
  const rows = [];
  for (const c of clients) {
    const [r, awaitingClient, changeRequests, scheduled] = await Promise.all([
      getMonthlyReport(c.id, { year, month }),
      prisma.draft.count({ where: { userId: c.id, status: "à valider", clientFeedback: null } }),
      prisma.draft.count({ where: { userId: c.id, status: "à valider", clientFeedback: { not: null } } }),
      prisma.draft.count({ where: { userId: c.id, status: "programmé" } }),
    ]);
    rows.push({
      id: c.id, name: c.companyName || c.name,
      published: r.postsPublished, impressions: r.totalImpressions, engagementRate: r.avgEngagementRate,
      clientApproved: r.clientApproved, awaitingClient, changeRequests, scheduled,
    });
  }
  return NextResponse.json({ year, month, rows });
}
