import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { phylloFetch, isPhylloConfigured } from "@/lib/phyllo";

// Statistiques du profil personnel via Phyllo :
// identité (followers) + contenus récents avec engagement.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!isPhylloConfigured()) return NextResponse.json({ connected: false });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phylloAccountId: true },
  });
  if (!user?.phylloAccountId) return NextResponse.json({ connected: false });

  try {
    const accountId = user.phylloAccountId;
    const [profileRes, contentsRes] = await Promise.all([
      phylloFetch(`/v1/profiles?account_id=${accountId}`).catch(() => null),
      phylloFetch(`/v1/social/contents?account_id=${accountId}&limit=25`).catch(() => null),
    ]);

    const profile = profileRes?.data?.[0] ?? null;
    const contents = (contentsRes?.data ?? [])
      .map((c) => ({
        id: c.id,
        title: (c.title || c.description || "").slice(0, 120),
        url: c.url ?? null,
        publishedAt: c.published_at ?? null,
        likes: c.engagement?.like_count ?? null,
        comments: c.engagement?.comment_count ?? null,
        shares: c.engagement?.share_count ?? null,
        views: c.engagement?.view_count ?? c.engagement?.impression_organic_count ?? null,
      }))
      .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));

    const sum = (k) => contents.reduce((acc, c) => acc + (c[k] ?? 0), 0);

    return NextResponse.json({
      connected: true,
      profile: profile
        ? {
            name: profile.full_name ?? null,
            followers: profile.reputation?.follower_count ?? null,
            connections: profile.reputation?.connection_count ?? null,
          }
        : null,
      aggregate: {
        posts: contents.length,
        likes: sum("likes"),
        comments: sum("comments"),
        shares: sum("shares"),
        views: sum("views"),
      },
      contents,
    });
  } catch (e) {
    console.error("Erreur stats Phyllo:", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
