import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { estimateCost } from "@/lib/usage";
import { readLinkedinCalls } from "@/lib/linkedinCalls";
import { liCalls } from "@/lib/aiGuard";

// Tableau de bord technique, suite : carnet de bêta, coûts d'IA, capacité LinkedIn. Lu après la vue d'ensemble (plus lourd).
const WHISPER_PER_MIN = 0.006; // USD, estimation de la transcription
const day = (d) => d.toISOString().slice(0, 10);
const weekOf = (d) => Math.floor(d.getTime() / (7 * 86400000));

async function safe(fn) {
  try { return await fn(); } catch (e) { return { unavailable: true, error: String(e?.message ?? e).slice(0, 200) }; }
}

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const now = Date.now();
  const since7 = new Date(now - 7 * 86400000), since14 = new Date(now - 14 * 86400000), since30 = new Date(now - 30 * 86400000), since90 = new Date(now - 90 * 86400000);

  const beta = await safe(async () => {
    const users = await prisma.user.findMany({
      where: { role: { not: "admin" } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, email: true, name: true, plan: true, createdAt: true, trialEndsAt: true, onboardedAt: true, subscriptionStatus: true, linkedin: { select: { personToken: true, orgToken: true } } },
    });
    const ids = users.map((u) => u.id);
    const [drafts, firstPub, logins, active] = await Promise.all([
      prisma.draft.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
      prisma.draft.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "publié" }, _count: { _all: true }, _min: { publishedAt: true } }),
      prisma.activityEvent.groupBy({ by: ["userId"], where: { kind: "login", userId: { in: ids } }, _max: { createdAt: true } }),
      prisma.activityEvent.findMany({ where: { kind: "active", userId: { in: ids }, createdAt: { gte: since90 } }, select: { userId: true, createdAt: true } }),
    ]);
    const nDrafts = Object.fromEntries(drafts.map((d) => [d.userId, d._count._all]));
    const pub = Object.fromEntries(firstPub.map((d) => [d.userId, { n: d._count._all, first: d._min.publishedAt }]));
    const lastLogin = Object.fromEntries(logins.map((l) => [l.userId, l._max.createdAt]));
    const weeks = {}, days14 = {};
    for (const a of active) {
      (weeks[a.userId] ??= new Set()).add(weekOf(a.createdAt));
      if (a.createdAt >= since14) days14[a.userId] = (days14[a.userId] ?? 0) + 1;
    }
    const rows = users.map((u) => ({
      id: u.id, email: u.email, name: u.name, plan: u.plan, createdAt: u.createdAt, trialEndsAt: u.trialEndsAt, paying: ["active", "trialing"].includes(u.subscriptionStatus),
      onboarded: Boolean(u.onboardedAt), linkedin: Boolean(u.linkedin?.personToken || u.linkedin?.orgToken),
      drafts: nDrafts[u.id] ?? 0, published: pub[u.id]?.n ?? 0, firstPublishedAt: pub[u.id]?.first ?? null,
      lastLogin: lastLogin[u.id] ?? null, activeDays14: days14[u.id] ?? 0, activeWeeks: weeks[u.id]?.size ?? 0,
    }));
    const count = (f) => rows.filter(f).length;
    const funnel = [
      ["Inscrits", rows.length], ["Parcours terminé", count((r) => r.onboarded)], ["LinkedIn connecté", count((r) => r.linkedin)],
      ["Premier post créé", count((r) => r.drafts > 0)], ["Premier post publié", count((r) => r.published > 0)],
      ["Actifs cette semaine", count((r) => r.lastLogin && new Date(r.lastLogin) >= since7)], ["Actifs 2 semaines différentes", count((r) => r.activeWeeks >= 2)],
    ];
    return { funnel, rows: rows.slice(0, 60), total: rows.length };
  });

  const costs = await safe(async () => {
    const ev = await prisma.usageEvent.findMany({ where: { createdAt: { gte: since30 } }, select: { userId: true, kind: true, inputTokens: true, outputTokens: true, images: true, seconds: true, createdAt: true } });
    const cost = (e) => estimateCost(e) + (e.seconds / 60) * WHISPER_PER_MIN;
    const byDay = {}, byKind = {}, byUser = {};
    for (let i = 29; i >= 0; i--) byDay[day(new Date(now - i * 86400000))] = 0;
    for (const e of ev) {
      const c = cost(e);
      const d = day(e.createdAt);
      if (d in byDay) byDay[d] += c;
      byKind[e.kind] = (byKind[e.kind] ?? 0) + c;
      byUser[e.userId] = (byUser[e.userId] ?? 0) + c;
    }
    const topIds = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const users = await prisma.user.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, email: true, plan: true } });
    const um = Object.fromEntries(users.map((u) => [u.id, u]));
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    let mtd = 0;
    for (const e of ev) if (e.createdAt >= monthStart) mtd += cost(e);
    const elapsed = Math.max(1, (now - monthStart.getTime()) / 86400000);
    const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const total30 = Object.values(byDay).reduce((a, b) => a + b, 0);
    return {
      byDay: Object.entries(byDay).map(([d, usd]) => ({ day: d, usd })), byKind: Object.entries(byKind).sort((a, b) => b[1] - a[1]), total30,
      top: topIds.map(([id, usd]) => ({ email: um[id]?.email ?? "compte supprimé", plan: um[id]?.plan ?? "", usd })),
      monthToDate: mtd, monthProjected: (mtd / elapsed) * dim, accountsUsingAi: Object.keys(byUser).length,
    };
  });

  const linkedin = await safe(async () => {
    const stored = await readLinkedinCalls();
    const merged = { ...stored };
    for (const [d, c] of Object.entries(liCalls)) { const s = (merged[d] ??= { n: 0, err: 0, r429: 0 }); merged[d] = { n: s.n + c.n, err: s.err + c.err, r429: s.r429 + c.r429 }; }
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = day(new Date(now - i * 86400000)); days.push({ day: d, ...(merged[d] ?? { n: 0, err: 0, r429: 0 }) }); }
    const [persons, orgs, stats, withOrgs] = await Promise.all([
      prisma.linkedInAccount.count({ where: { personToken: { not: null } } }),
      prisma.linkedInAccount.count({ where: { orgToken: { not: null } } }),
      prisma.linkedInAccount.count({ where: { statsToken: { not: null } } }),
      prisma.linkedInAccount.findMany({ where: { orgAccounts: { not: null } }, select: { orgAccounts: true } }),
    ]);
    let pages = 0;
    for (const a of withOrgs) { try { pages += JSON.parse(a.orgAccounts).length; } catch {} }
    return { days, persons, orgs, stats, pages, total14: days.reduce((a, d) => a + d.n, 0), r429: days.reduce((a, d) => a + d.r429, 0), errors: days.reduce((a, d) => a + d.err, 0) };
  });

  return NextResponse.json({ beta, costs, linkedin, caps: { pages: 10, statAccounts: 6 } });
}
