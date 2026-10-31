import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

// Visites du site (mesure faite par LinkeePost) et parcours bêta : pages vues, visiteurs par jour, pages, origines, appareils.
// « Visiteur » = empreinte du jour : un même visiteur revenu un autre jour compte deux fois (c'est le prix de l'absence de suivi).
const day = (d) => d.toISOString().slice(0, 10);

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const now = Date.now();
  const d14 = day(new Date(now - 13 * 86400000)), d7 = day(new Date(now - 6 * 86400000)), today = day(new Date(now));
  const since7 = new Date(now - 7 * 86400000);

  const rows = await prisma.siteVisit.findMany({ where: { day: { gte: d14 } }, select: { day: true, path: true, source: true, device: true, visitor: true } });
  const first = await prisma.siteVisit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });

  const byDay = {};
  for (let i = 13; i >= 0; i--) byDay[day(new Date(now - i * 86400000))] = new Set();
  const week = rows.filter((r) => r.day >= d7);
  for (const r of rows) byDay[r.day]?.add(r.visitor);
  const distinct = (list, key) => new Set(list.map((r) => `${r.day}:${r.visitor}:${key(r)}`)).size;
  const pages = {};
  for (const r of week) pages[r.path] = (pages[r.path] ?? 0) + 1;
  const sourceCount = {}, deviceCount = {};
  const seenS = new Set(), seenD = new Set();
  for (const r of week) {
    if (r.source !== "interne") { const k = `${r.day}:${r.visitor}:${r.source}`; if (!seenS.has(k)) { seenS.add(k); sourceCount[r.source] = (sourceCount[r.source] ?? 0) + 1; } }
    const kd = `${r.day}:${r.visitor}`; if (!seenD.has(kd)) { seenD.add(kd); deviceCount[r.device] = (deviceCount[r.device] ?? 0) + 1; }
  }
  const [requests, accounts] = await Promise.all([
    prisma.contactMessage.count({ where: { subject: { startsWith: "Demande d'invitation" }, createdAt: { gte: since7 } } }),
    prisma.user.count({ where: { role: { not: "admin" }, createdAt: { gte: since7 } } }),
  ]);
  return NextResponse.json({
    since: first?.createdAt ?? null,
    today: byDay[today]?.size ?? 0,
    visitors7: distinct(week, () => ""),
    views7: week.length,
    byDay: Object.entries(byDay).map(([d, s]) => ({ day: d, visitors: s.size })),
    pages: Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 8),
    sources: Object.entries(sourceCount).sort((a, b) => b[1] - a[1]),
    devices: Object.entries(deviceCount).sort((a, b) => b[1] - a[1]),
    funnel: [
      ["Visiteurs du site", distinct(week, () => "")],
      ["Page « Bêta fermée »", distinct(week.filter((r) => r.path === "/beta"), () => "")],
      ["Demandes d'invitation", requests],
      ["Comptes créés", accounts],
    ],
  });
}
