import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { sendMail, isMailerConfigured } from "@/lib/mailer";
import { rateLimit } from "@/lib/ratelimit";
import { buildManualMail, renderFor } from "@/lib/adminMail";

// POST { action: "preview" | "send", template: "leads" | "custom", userId, subject?, body?, confirm? }
// Envoi manuel d'un e-mail à l'équipe d'un client (ou à une personne). « preview » ne part nulle part ; « send » exige confirm: true,
// n'envoie qu'aux destinataires qui n'ont pas coupé les e-mails, et est inscrit au journal des actions d'administration.
export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = body.action === "send" ? "send" : "preview";
  if (!rateLimit(`admin-mail-${action}:${admin.id}`, { limit: action === "send" ? 20 : 120, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop de demandes sur la dernière heure." }, { status: 429 });
  }
  const built = await buildManualMail({ template: body.template, userId: body.userId, subject: body.subject, body: body.body });
  if (built.error) return NextResponse.json({ error: built.error }, { status: built.status ?? 400 });
  const shown = { template: built.template, subject: built.subject, text: built.text, account: built.account, recipients: built.recipients.map((r) => ({ id: r.id, email: r.email, name: r.name })), skipped: built.skipped };
  if (action === "preview") return NextResponse.json({ ok: true, ...shown, smtp: isMailerConfigured() });

  if (body.confirm !== true) return NextResponse.json({ error: "Confirmation requise avant l'envoi." }, { status: 400 });
  if (!isMailerConfigured()) return NextResponse.json({ error: "L'envoi d'e-mails n'est pas configuré sur le serveur (SMTP_HOST absent).", code: "smtp" }, { status: 503 });
  let sent = 0, failed = 0;
  for (const u of built.recipients) {
    try { (await sendMail({ to: u.email, ...renderFor(built, u) })) ? sent++ : failed++; } catch (e) { failed++; console.error("[admin] envoi manuel :", e.message); }
  }
  await prisma.adminAction.create({ data: { adminId: admin.id, adminEmail: admin.email, action: "email.manuel", ok: sent > 0, detail: { template: built.template, subject: built.subject.slice(0, 120), compte: built.account.id, destinataires: built.recipients.length, envoyes: sent, echecs: failed } } }).catch(() => {});
  if (!sent) return NextResponse.json({ error: "Aucun message n'a pu partir (adresses sans boîte aux lettres, ou serveur d'e-mails indisponible).", ...shown, sent, failed }, { status: 502 });
  return NextResponse.json({ ok: true, ...shown, sent, failed });
}
