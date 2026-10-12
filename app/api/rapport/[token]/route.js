import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { findReportLink } from "@/lib/reportLink";
import { findKit } from "@/lib/brandKitStore";
import { getMonthlyReport } from "@/lib/reports/monthly";

// Public : rapport mensuel d'un client derrière son lien secret (lecture seule), aux couleurs de l'agence
export async function GET(req, { params }) {
  if (!rateLimit(`report:${clientIp(req)}`, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
  }
  const { token } = await params;
  const link = await findReportLink(token);
  if (!link) return NextResponse.json({ error: "Ce lien n'est plus valide. Demandez-en un nouveau à votre agence." }, { status: 404 });

  const now = new Date();
  const sp = new URL(req.url).searchParams;
  const year = Number(sp.get("year")) || now.getFullYear();
  const month = Number(sp.get("month")) || now.getMonth() + 1;
  if (month < 1 || month > 12 || year < 2020 || new Date(year, month - 1, 1) > now) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 });
  }
  const [report, kit] = await Promise.all([getMonthlyReport(link.userId, { year, month }), findKit(link.createdBy, null)]);
  return NextResponse.json({
    client: link.user.companyName || link.user.name,
    agency: link.user.agency?.name ?? null,
    brand: { primaryColor: kit?.primaryColor || "#1b2a4a", accentColor: kit?.accentColor || "#ff5a5f", logoUrl: kit?.logoUrl ?? null, tagline: kit?.tagline ?? null },
    year, month, report,
  });
}
