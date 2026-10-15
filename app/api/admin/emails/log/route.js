import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { EMAIL_KINDS } from "@/lib/emailKinds";

// GET — journal des e-mails envoyés : par type sur 30 jours (envoyés, échecs, dernier envoi) et les 40 derniers messages (administrateur)
export async function GET(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const since = new Date(Date.now() - 30 * 86400000);
  const [groups, lasts, recent] = await Promise.all([
    prisma.emailLog.groupBy({ by: ["kind", "status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.emailLog.groupBy({ by: ["kind"], where: { status: "envoyé" }, _max: { createdAt: true } }),
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 40, select: { id: true, createdAt: true, kind: true, toMasked: true, subject: true, status: true, error: true } }),
  ]);
  const count = (kind, status) => groups.find((g) => g.kind === kind && g.status === status)?._count._all ?? 0;
  const last = (kind) => lasts.find((l) => l.kind === kind)?._max.createdAt ?? null;
  const rows = EMAIL_KINDS.map((k) => ({ ...k, sent: count(k.kind, "envoyé"), failed: count(k.kind, "échec"), last: last(k.kind) }));
  return NextResponse.json({
    rows,
    tests: { sent: count("test", "envoyé"), failed: count("test", "échec") },
    recent,
    since,
  });
}
