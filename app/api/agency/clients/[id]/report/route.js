import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { checkFeature } from "@/lib/gating";
import { getMonthlyReport } from "@/lib/reports/monthly";

// GET /api/agency/clients/[id]/report?year=2026&month=9
// Rapport mensuel de performance d'un client géré — réservé à l'offre Agence
// (même garde que les statistiques de page entreprise : orgStats).
export async function GET(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const gate = await checkFeature(userId, "orgStats", "Le rapport de performance");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { id: clientId } = await params;
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { managedByUserId: true, name: true, companyName: true },
  });
  if (!client || client.managedByUserId !== userId) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Mois invalide." }, { status: 400 });
  }

  const report = await getMonthlyReport(clientId, { year, month });
  return NextResponse.json({ client: { name: client.name, companyName: client.companyName }, report });
}
