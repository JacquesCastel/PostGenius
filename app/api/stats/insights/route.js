import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { MOODS } from "@/lib/moods";

// Ce qui ressort des mesures déjà enregistrées (jamais d'appel à LinkedIn ici) :
//  - series : relevés quotidiens des totaux du profil (cumul « à vie » à chaque date) ;
//  - posts : dernière mesure de chaque post publié (J+1 ou J+7) ;
//  - byMood / byTheme : moyennes par humeur et par thématique, avec le nombre de posts mesurés (en dessous de 3, c'est du bruit).

const engagement = (p) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);

function group(rows, keyOf, labelOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const g = map.get(k) ?? { key: k, label: labelOf(k), n: 0, impressions: 0, likes: 0, comments: 0, shares: 0, withImpressions: 0 };
    g.n++;
    g.impressions += r.impressions ?? 0;
    g.likes += r.likes ?? 0;
    g.comments += r.comments ?? 0;
    g.shares += r.shares ?? 0;
    if (r.impressions) g.withImpressions++;
    map.set(k, g);
  }
  return [...map.values()]
    .map((g) => ({
      key: g.key,
      label: g.label,
      n: g.n,
      avgImpressions: g.n ? Math.round(g.impressions / g.n) : 0,
      avgReactions: g.n ? Math.round((g.likes / g.n) * 10) / 10 : 0,
      avgComments: g.n ? Math.round((g.comments / g.n) * 10) / 10 : 0,
      rate: g.impressions ? (g.likes + g.comments + g.shares) / g.impressions : null, // engagement / impressions
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
}

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const since = new Date(Date.now() - 120 * 86400000);
  const [snaps, drafts, contexts, user] = await Promise.all([
    prisma.statSnapshot.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { day: "asc" }, select: { day: true, impressions: true, reactions: true, comments: true, shares: true, clicks: true, reached: true } }),
    prisma.draft.findMany({
      where: { userId, status: "publié", performance: { some: {} } },
      orderBy: { publishedAt: "desc" },
      take: 200,
      select: { id: true, mood: true, contextId: true, publishedAt: true, performance: { select: { offsetHours: true, capturedAt: true, impressions: true, likes: true, comments: true, shares: true, clicks: true } } },
    }),
    prisma.context.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { companyName: true } }),
  ]);

  const posts = drafts.map((d) => {
    const latest = [...d.performance].sort((a, b) => b.offsetHours - a.offsetHours)[0];
    return { id: d.id, mood: d.mood ?? null, contextId: d.contextId ?? null, publishedAt: d.publishedAt, offsetHours: latest.offsetHours, capturedAt: latest.capturedAt, impressions: latest.impressions, likes: latest.likes, comments: latest.comments, shares: latest.shares, clicks: latest.clicks };
  });

  const themeName = new Map(contexts.map((c) => [c.id, c.name]));
  const byMood = group(posts, (p) => p.mood ?? "none", (k) => (k === "none" ? "Sans humeur choisie" : MOODS.find((m) => m.code === k)?.label ?? k));
  const byTheme = group(posts, (p) => p.contextId ?? "main", (k) => (k === "main" ? user?.companyName || "Mon activité" : themeName.get(k) ?? "Thématique supprimée"));

  return NextResponse.json({ series: snaps, posts, byMood, byTheme, measured: posts.length });
}
