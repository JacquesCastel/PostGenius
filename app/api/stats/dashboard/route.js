import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { utcDay } from "@/lib/linkedin/profileStats";
import { pageResults } from "@/lib/linkedin/orgDaily";

// Carte « Vos résultats » du tableau de bord : 30 derniers jours (hors aujourd'hui) et variation par rapport aux 30 jours d'avant.
//  - scope=profile : lit uniquement le dernier relevé enregistré (aucun appel à LinkedIn) ; séries par jour du relevé, sinon écarts entre relevés.
//  - scope=page&org=urn:li:organization:… : série par jour de la page (un appel, gardé 6 h) + meilleur post.

const METRICS = [["impressions", "IMPRESSION"], ["reactions", "REACTION"], ["comments", "COMMENT"]];
const dayAt = (offset) => utcDay(new Date(Date.now() + offset * 86400000)); // offset -1 = hier

// daily : { IMPRESSION: { "AAAA-MM-JJ": n }, … } → totaux, variation et mini-courbe par mesure
function summarize(daily) {
  const cur = Array.from({ length: 30 }, (_, i) => dayAt(i - 30)); // J-30 … J-1
  const prev = Array.from({ length: 30 }, (_, i) => dayAt(i - 60)); // J-60 … J-31
  const out = {};
  for (const [key, q] of METRICS) {
    const m = daily?.[q];
    if (!m) { out[key] = null; continue; }
    const sum = (days) => days.reduce((a, d) => a + (m[d] ?? 0), 0);
    const hasPrev = prev.some((d) => m[d] != null);
    const total = sum(cur), before = hasPrev ? sum(prev) : null;
    out[key] = { total, prev: before, change: before ? (total - before) / before : null, spark: cur.map((d) => m[d] ?? 0) };
  }
  return out;
}

// Relevés cumulés → série par jour (écart entre deux relevés consécutifs), faute de séries par jour dans le relevé
function dailyFromSnapshots(rows) {
  const daily = { IMPRESSION: {}, REACTION: {}, COMMENT: {} };
  for (let i = 1; i < rows.length; i++) {
    for (const [key, q] of METRICS) {
      if (rows[i][key] == null || rows[i - 1][key] == null) continue;
      daily[q][rows[i].day] = Math.max(0, rows[i][key] - rows[i - 1][key]);
    }
  }
  return daily;
}

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const since = new Date(Date.now() - 30 * 86400000);

  if (searchParams.get("scope") === "page") {
    const org = searchParams.get("org");
    if (!/^urn:li:organization:\d+$/.test(org ?? "")) return NextResponse.json({ error: "Paramètre org invalide." }, { status: 400 });
    const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgToken: true, orgExpiresAt: true } });
    const token = decryptToken(acc?.orgToken);
    if (!token || (acc.orgExpiresAt && acc.orgExpiresAt < new Date())) return NextResponse.json({ connected: false, scope: "page" });
    const drafts = await prisma.draft.findMany({ where: { userId, status: "publié", target: org, postId: { not: null }, publishedAt: { gte: since } }, orderBy: { publishedAt: "desc" }, take: 20, select: { id: true, theme: true, postId: true, publishedAt: true } });
    try {
      const r = await pageResults(userId, token, org, drafts);
      return NextResponse.json({ connected: true, scope: "page", metrics: summarize(r.daily), best: r.best, asOf: new Date(r.at).toISOString(), stale: Boolean(r.stale) });
    } catch (e) {
      return NextResponse.json({ connected: true, scope: "page", metrics: null, quotaLimited: e.status === 429, error: e.status === 429 ? null : "Résultats de la page indisponibles pour le moment." });
    }
  }

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { statsToken: true, statsExpiresAt: true } });
  if (!decryptToken(acc?.statsToken) || (acc.statsExpiresAt && acc.statsExpiresAt < new Date())) return NextResponse.json({ connected: false, scope: "profile" });
  const snap = await prisma.statSnapshot.findFirst({ where: { userId, detailed: true }, orderBy: { day: "desc" } });
  if (!snap) return NextResponse.json({ connected: true, scope: "profile", metrics: null, pending: true });

  let daily = snap.body?.daily;
  let source = "daily";
  if (!daily) {
    const rows = await prisma.statSnapshot.findMany({ where: { userId, day: { gte: dayAt(-61) } }, orderBy: { day: "asc" }, select: { day: true, impressions: true, reactions: true, comments: true } });
    daily = dailyFromSnapshots(rows);
    source = "snapshots";
  }
  const metrics = summarize(daily);
  // Dès le début de l'historique, une seule journée d'écart : mieux vaut « en cours de collecte » que des chiffres à zéro
  const building = METRICS.every(([k]) => !metrics[k] || metrics[k].total === 0) && source === "snapshots";

  // Meilleur post des 30 derniers jours, d'après le relevé
  const recent = await prisma.draft.findMany({ where: { userId, status: "publié", target: "person", publishedAt: { gte: since } }, select: { id: true, theme: true, publishedAt: true } });
  const byId = new Map(recent.map((d) => [d.id, d]));
  let best = null;
  for (const p of snap.body?.posts ?? []) {
    const d = byId.get(p.id), s = p.stats ?? {};
    if (!d || s.impressionCount == null) continue;
    if (!best || s.impressionCount > best.impressions) best = { id: d.id, theme: d.theme, publishedAt: d.publishedAt, impressions: s.impressionCount, reactions: s.likeCount ?? 0, comments: s.commentCount ?? 0 };
  }
  return NextResponse.json({ connected: true, scope: "profile", metrics, best, building, source, asOf: snap.createdAt, stale: snap.day !== utcDay() });
}
