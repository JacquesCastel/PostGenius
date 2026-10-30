import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { readBackupStatus, evaluateBackup } from "@/lib/backupHealth";
import { getFlags } from "@/lib/opsFlags";
import { aiStats } from "@/lib/aiGuard";
import { readDeployJournal, readVersion } from "@/lib/techState";

// Tableau de bord technique (super-admin) : santé, déploiements, usage, interrupteurs, journal des actions.
// Chaque bloc est lu séparément : une lecture qui échoue donne un bloc « indisponible », jamais un écran vide.
const day = (d) => d.toISOString().slice(0, 10);

async function safe(fn) {
  try { return await fn(); } catch (e) { return { unavailable: true, error: String(e?.message ?? e).slice(0, 200) }; }
}

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const now = Date.now();
  const since24 = new Date(now - 86400000), since7 = new Date(now - 7 * 86400000), since14 = new Date(now - 14 * 86400000);

  const [db, host, activity, problems, journal, version, actions, flags, accounts] = await Promise.all([
    safe(async () => { const t = Date.now(); await prisma.$queryRaw`SELECT 1`; return { ok: true, ms: Date.now() - t }; }),
    safe(async () => {
      const raw = await fs.readFile(path.join(process.cwd(), "data", "health.json"), "utf8");
      const status = await readBackupStatus();
      return { ...JSON.parse(raw), backup: { status, ...evaluateBackup(status) } };
    }),
    safe(async () => {
      const events = await prisma.activityEvent.findMany({ where: { createdAt: { gte: since14 } }, select: { userId: true, kind: true, createdAt: true } });
      const days = {};
      for (let i = 13; i >= 0; i--) days[day(new Date(now - i * 86400000))] = new Set();
      const kinds7 = {};
      for (const e of events) {
        if (e.kind === "active" && days[day(e.createdAt)] && e.userId) days[day(e.createdAt)].add(e.userId);
        if (e.createdAt >= since7) kinds7[e.kind] = (kinds7[e.kind] ?? 0) + 1;
      }
      const first = events.length ? events.reduce((m, e) => (e.createdAt < m ? e.createdAt : m), events[0].createdAt) : null;
      return { activeByDay: Object.entries(days).map(([d, s]) => ({ day: d, users: s.size })), kinds7, since: first };
    }),
    safe(async () => {
      const [emailFailed, emailSent, draftErrors, jobs, recentErrors] = await Promise.all([
        prisma.emailLog.count({ where: { status: "échec", createdAt: { gte: since24 } } }),
        prisma.emailLog.count({ where: { status: "envoyé", createdAt: { gte: since24 } } }),
        prisma.draft.count({ where: { status: "erreur", scheduledAt: { gte: since7 } } }),
        prisma.mediaJob.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.draft.findMany({ where: { status: "erreur", scheduledAt: { gte: since7 } }, orderBy: { scheduledAt: "desc" }, take: 5, select: { id: true, publishError: true, scheduledAt: true } }),
      ]);
      const due = await prisma.draft.count({ where: { status: "programmé", scheduledAt: { lte: new Date(now - 10 * 60000) } } });
      return { emailFailed, emailSent, draftErrors, jobs: Object.fromEntries(jobs.map((j) => [j.status, j._count._all])), recentErrors, lateScheduled: due };
    }),
    readDeployJournal(30),
    readVersion(),
    safe(() => prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 30 })),
    getFlags(),
    safe(async () => {
      const [total, disabled, trial, paying, newWeek] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { disabled: true } }),
        prisma.user.count({ where: { trialEndsAt: { gt: new Date() }, subscriptionStatus: null } }),
        prisma.user.count({ where: { subscriptionStatus: { in: ["active", "trialing"] } } }),
        prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      ]);
      return { total, disabled, trial, paying, newWeek };
    }),
  ]);

  const sched = globalThis.__schedulerState ?? null;
  const mem = process.memoryUsage();
  return NextResponse.json({
    now,
    process: { uptimeSec: Math.round(process.uptime()), node: process.version, rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576) },
    db, host, activity, problems, accounts,
    scheduler: sched,
    ai: { ...aiStats },
    stripe: { configured: Boolean(process.env.STRIPE_SECRET_KEY), webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET), last: globalThis.__stripeLast ?? null },
    config: {
      smtp: Boolean(process.env.SMTP_HOST), anthropic: Boolean(process.env.ANTHROPIC_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY),
      appUrl: process.env.APP_URL ?? null, neonSnapshots: Boolean(process.env.NEON_API_KEY),
    },
    deploys: { version, journal },
    flags,
    actions,
  });
}
