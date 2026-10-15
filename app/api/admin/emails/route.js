import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { isMailerConfigured } from "@/lib/mailer";
import { EMAIL_TESTS, LIVE_TESTS } from "@/lib/emailTests";
import { prisma } from "@/lib/db";

// GET — état de l'envoi d'e-mails et liste des messages d'exemple (administrateur)
export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  return NextResponse.json({
    smtp: isMailerConfigured(),
    from: process.env.SMTP_FROM || null,
    to: admin.email,
    tests: [...EMAIL_TESTS, ...LIVE_TESTS].map(({ id, group, label, needs }) => ({ id, group, label, needs: needs ?? null })),
    accounts: (await prisma.user.findMany({ where: { disabled: false }, select: { id: true, name: true, email: true, companyName: true, plan: true, agencyId: true, agencyMembership: { select: { agencyId: true } } }, orderBy: { createdAt: "desc" }, take: 500 }))
      .map((u) => ({ id: u.id, client: Boolean(u.agencyId), member: Boolean(u.agencyMembership), label: u.agencyId ? `${u.companyName || u.name} (client d'agence)` : `${u.name || u.email} — ${u.email}` })),
  });
}
