import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isMailerConfigured } from "@/lib/mailer";
import { EMAIL_TESTS } from "@/lib/emailTests";

// GET — état de l'envoi d'e-mails et liste des messages d'exemple (administrateur)
export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  return NextResponse.json({
    smtp: isMailerConfigured(),
    from: process.env.SMTP_FROM || null,
    to: admin.email,
    tests: EMAIL_TESTS.map(({ id, group, label }) => ({ id, group, label })),
  });
}
