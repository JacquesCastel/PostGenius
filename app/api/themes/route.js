import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { MAX_CONTEXTS } from "@/lib/contexts";
import { momentState } from "@/lib/moments";
import { isMood } from "@/lib/moods";

// « Mes thématiques » : la thématique du profil et les autres, sur un pied d'égalité, avec de quoi remplir une carte
// (cible, nombre de sources et de posts, dernier post, humeurs, temps forts en cours). Lecture seule.

const excerpt = (t, n = 140) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
};

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const [user, contexts, sourceRows, draftRows, moodRows, lastRows, moments] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { companyName: true, businessDescription: true, targetAudience: true, leadIcp: true, headline: true, website: true } }),
    prisma.context.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.knowledgeSource.groupBy({ by: ["contextId"], where: { userId, shared: false, momentId: null }, _count: { _all: true } }),
    prisma.draft.groupBy({ by: ["contextId"], where: { userId }, _count: { _all: true } }),
    prisma.draft.groupBy({ by: ["contextId", "mood"], where: { userId, mood: { not: null } }, _count: { _all: true } }),
    prisma.draft.groupBy({ by: ["contextId"], where: { userId }, _max: { createdAt: true } }),
    prisma.moment.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const key = (id) => id ?? "main";
  const count = (rows) => Object.fromEntries(rows.map((r) => [key(r.contextId), r._count._all]));
  const sources = count(sourceRows);
  const posts = count(draftRows);
  const last = Object.fromEntries(lastRows.map((r) => [key(r.contextId), r._max.createdAt]));
  const moods = {};
  for (const r of moodRows) (moods[key(r.contextId)] ??= []).push([r.mood, r._count._all]);
  const topMoods = (k, genres) => {
    const used = (moods[k] ?? []).sort((a, b) => b[1] - a[1]).map(([m]) => m).filter(isMood).slice(0, 2);
    if (used.length) return used;
    return String(genres ?? "").split(",").map((x) => x.trim()).filter(isMood).slice(0, 2);
  };
  const momentsOf = (id) => moments.filter((m) => (m.contextId ?? null) === id).map((m) => ({ id: m.id, name: m.name, startsAt: m.startsAt, endsAt: m.endsAt, state: momentState(m) })).filter((m) => m.state === "active" || m.state === "upcoming");
  const home = {
    id: "main", kind: "activity", name: user?.companyName || "Mon activité", role: user?.headline ?? "", website: user?.website ?? "", description: excerpt(user?.businessDescription),
    target: user?.targetAudience ?? "", leadIcp: user?.leadIcp ?? "", genres: "",
  };
  const themes = [home, ...contexts.map((c) => ({ id: c.id, kind: c.kind ?? "activity", name: c.name, role: c.role ?? "", website: c.website ?? "", description: excerpt(c.businessDescription), target: c.targetAudience ?? "", leadIcp: c.leadIcp ?? "", genres: c.postGenres ?? "" }))].map((t) => {
    const k = t.id;
    const ctxId = k === "main" ? null : k;
    return { ...t, sources: sources[k] ?? 0, posts: posts[k] ?? 0, lastPostAt: last[k] ?? null, moods: topMoods(k, t.genres), moments: momentsOf(ctxId) };
  });
  return NextResponse.json({ themes, max: MAX_CONTEXTS });
}
