import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { advisorEnabled } from "@/lib/advisorFlag";
import { ADVISOR_MODES } from "@/lib/advisorFlag";
import { getAdvisorMode, setAdvisorMode } from "@/lib/advisorAccess";

// Périmètre du conseiller éditorial : tous les comptes, seulement les comptes cochés, ou personne.

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const [mode, allowed] = await Promise.all([getAdvisorMode(), prisma.user.count({ where: { advisorAccess: true } })]);
  return NextResponse.json({ mode, allowed, serverOn: advisorEnabled() });
}

export async function PUT(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!ADVISOR_MODES.includes(body.mode)) return NextResponse.json({ error: "Mode invalide." }, { status: 400 });
  const before = await getAdvisorMode();
  await setAdvisorMode(body.mode);
  await prisma.adminAction.create({ data: { adminId: admin.id, adminEmail: admin.email, action: "advisor-mode", ok: true, detail: `${before} → ${body.mode}` } }).catch(() => {});
  return NextResponse.json({ ok: true, mode: body.mode });
}
