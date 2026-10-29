import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { analyze, MIN_MEASURED } from "@/lib/coach";

// « Le coach » : ce qui marche le mieux chez vous, d'après les mesures déjà enregistrées de vos posts (aucun appel à LinkedIn, aucune IA).
// scope=profile (posts du profil), scope=page&org=urn:li:organization:… (posts de cette page) ou scope=all (tout, pour les créneaux conseillés).

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";
  const org = searchParams.get("org");
  if (scope === "page" && !/^urn:li:organization:\d+$/.test(org ?? "")) return NextResponse.json({ error: "Paramètre org invalide." }, { status: 400 });

  const target = scope === "profile" ? { target: "person" } : scope === "page" ? { target: org } : {};
  const [drafts, contexts, user] = await Promise.all([
    prisma.draft.findMany({
      where: { userId, status: "publié", performance: { some: {} }, ...target },
      orderBy: { publishedAt: "desc" },
      take: 300,
      select: { id: true, publishedAt: true, target: true, text: true, type: true, imageUrl: true, videoUrl: true, youtubeUrl: true, mood: true, contextId: true, performance: { select: { offsetHours: true, impressions: true, likes: true, comments: true, shares: true } } },
    }),
    prisma.context.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { companyName: true, publishDays: true, publishTime: true } }),
  ]);

  const rows = drafts.map((d) => {
    const latest = [...d.performance].sort((a, b) => b.offsetHours - a.offsetHours)[0];
    const { performance, ...rest } = d;
    return { ...rest, impressions: latest?.impressions, likes: latest?.likes, comments: latest?.comments, shares: latest?.shares };
  });
  const result = analyze(rows, { themeNames: new Map(contexts.map((c) => [c.id, c.name])), mainThemeName: user?.companyName || "Mon activité" });
  const current = { days: (user?.publishDays ?? "").split(",").map(Number).filter(Boolean), time: user?.publishTime ?? null };
  return NextResponse.json({ scope, minMeasured: MIN_MEASURED, ...result, current });
}
