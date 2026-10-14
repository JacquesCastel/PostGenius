import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, ownClient } from "@/lib/agency";
import { newApprovalToken, approvalUrl, sendApprovalEmail } from "@/lib/approval";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const view = (l) => ({ url: approvalUrl(l.token), sentTo: l.sentTo, lastSentAt: l.lastSentAt, autoReminders: l.autoReminders, autoReport: l.autoReport });

// GET /api/agency/clients/:id/approval — lien de validation du client (nul s'il n'a pas encore été créé)
export async function GET(req, { params }) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  if (!(await ownClient(auth, id))) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  const link = await prisma.approvalLink.findUnique({ where: { userId: id } });
  return NextResponse.json({ link: link ? view(link) : null });
}

// POST /api/agency/clients/:id/approval — crée le lien (ou le régénère : l'ancien cesse de fonctionner) ; { email } l'envoie au client
export async function POST(req, { params }) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const client = await ownClient(auth, id, { id: true, name: true, companyName: true, agency: { select: { name: true } } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email && !EMAIL.test(email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });

  let link = await prisma.approvalLink.findUnique({ where: { userId: id } });
  if (!link) link = await prisma.approvalLink.create({ data: { userId: id, token: newApprovalToken() } });
  else if (body.regenerate) link = await prisma.approvalLink.update({ where: { userId: id }, data: { token: newApprovalToken(), createdAt: new Date(), lastSentAt: null, sentTo: null } });

  // Envois automatiques au client (désactivés par défaut) : seul un booléen reçu modifie le réglage
  const flags = {};
  if (typeof body.autoReminders === "boolean") flags.autoReminders = body.autoReminders;
  if (typeof body.autoReport === "boolean") flags.autoReport = body.autoReport;
  if (Object.keys(flags).length) link = await prisma.approvalLink.update({ where: { userId: id }, data: flags });

  let mailed = null;
  if (email) {
    mailed = await sendApprovalEmail({ to: email, link, clientName: client.companyName || client.name, agencyName: client.agency?.name });
    if (mailed) link = await prisma.approvalLink.update({ where: { userId: id }, data: { lastSentAt: new Date(), sentTo: email } });
  }
  return NextResponse.json({ link: view(link), mailed });
}
