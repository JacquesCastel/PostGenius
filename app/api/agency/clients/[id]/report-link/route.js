import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, ownClient } from "@/lib/agency";
import { checkFeature, limitBody } from "@/lib/gating";
import { newReportToken, reportUrl } from "@/lib/reportLink";

async function guard(req, params) {
  const auth = await requireAgency(req);
  if (auth.error) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const gate = await checkFeature(auth.userId, "orgStats", "Le rapport de performance");
  if (!gate.ok) return { res: NextResponse.json(limitBody(gate), { status: 403 }) };
  const { id } = await params;
  if (!(await ownClient(auth, id))) return { res: NextResponse.json({ error: "Client introuvable" }, { status: 404 }) };
  return { auth, id };
}

// GET /api/agency/clients/:id/report-link — lien de partage du rapport (nul s'il n'existe pas encore)
export async function GET(req, { params }) {
  const g = await guard(req, params);
  if (g.res) return g.res;
  const link = await prisma.reportLink.findUnique({ where: { userId: g.id } });
  return NextResponse.json({ link: link ? { url: reportUrl(link.token) } : null });
}

// POST /api/agency/clients/:id/report-link — crée le lien ; { regenerate: true } l'invalide et en crée un nouveau.
// La charte qui habille le rapport est celle de l'utilisateur qui crée ou régénère le lien.
export async function POST(req, { params }) {
  const g = await guard(req, params);
  if (g.res) return g.res;
  const body = await req.json().catch(() => ({}));
  let link = await prisma.reportLink.findUnique({ where: { userId: g.id } });
  if (!link) link = await prisma.reportLink.create({ data: { userId: g.id, token: newReportToken(), createdBy: g.auth.userId } });
  else if (body.regenerate) link = await prisma.reportLink.update({ where: { userId: g.id }, data: { token: newReportToken(), createdBy: g.auth.userId, createdAt: new Date() } });
  return NextResponse.json({ link: { url: reportUrl(link.token) } });
}
