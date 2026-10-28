import { prisma } from "../db";
import { decryptToken } from "../crypto";
import { fetchMemberMetric, memberQuotaPaused } from "./memberStats";

// Statistiques du profil personnel : UNE lecture de LinkedIn par compte et par jour (jour UTC, comme la remise à zéro des quotas de LinkedIn),
// enregistrée dans StatSnapshot. L'écran « Statistiques », « Mes posts » et les courbes lisent ce relevé : ouvrir l'écran ne coûte aucun appel.
// Palier « Development » de LinkedIn : environ 100 appels par jour et par membre ; une lecture complète en coûte au plus 10 + 10 × 6 = 70.

const AGGREGATE_METRICS = [
  "IMPRESSION", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS",
  "MEMBERS_REACHED", "POST_SAVE", "POST_SEND", "FOLLOWER_GAINED_FROM_CONTENT", "PROFILE_VIEW_FROM_CONTENT",
];
const PER_POST_METRICS = ["IMPRESSION", "MEMBERS_REACHED", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS"];
const MAX_POSTS = 10;
const POST_BATCH = 3; // posts interrogés en parallèle
const OFFSETS_HOURS = [24, 168]; // paliers J+1 et J+7 des mesures par post (PostPerformance)

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10); // AAAA-MM-JJ (UTC)

const inFlight = new Map(); // userId → promesse en cours : deux demandes simultanées ne lisent LinkedIn qu'une fois

// Lecture complète auprès de LinkedIn. Lève une erreur portant `status` si TOUTES les mesures d'ensemble échouent (permission, session, quota).
async function readFromLinkedIn(token, userId) {
  const aggResults = await Promise.all(AGGREGATE_METRICS.map(async (q) => {
    try { return [q, await fetchMemberMetric(token, { queryType: q }), null]; } catch (e) { return [q, null, e.status ?? 500]; }
  }));
  const agg = Object.fromEntries(aggResults.map(([k, v]) => [k, v]));
  const statuses = aggResults.map(([, , s]) => s).filter(Boolean);
  if (statuses.length === AGGREGATE_METRICS.length) {
    const err = new Error("Toutes les métriques ont échoué.");
    err.status = statuses.includes(401) ? 401 : statuses.every((s) => s === 403) ? 403 : statuses[0];
    throw err;
  }
  const aggregate = {
    impressionCount: agg.IMPRESSION, likeCount: agg.REACTION, commentCount: agg.COMMENT, shareCount: agg.RESHARE, clickCount: agg.LINK_CLICKS,
    reachedCount: agg.MEMBERS_REACHED, saveCount: agg.POST_SAVE, sendCount: agg.POST_SEND, followerCount: agg.FOLLOWER_GAINED_FROM_CONTENT, profileViewCount: agg.PROFILE_VIEW_FROM_CONTENT,
  };

  const published = await prisma.draft.findMany({ where: { userId, status: "publié", target: "person", postId: { not: null } }, orderBy: { publishedAt: "desc" }, take: MAX_POSTS, select: { id: true, postId: true, publishedAt: true } });
  const fetchPost = async (d) => {
    const entries = await Promise.all(PER_POST_METRICS.map(async (q) => {
      try { return [q, await fetchMemberMetric(token, { entity: d.postId, queryType: q })]; } catch { return [q, null]; }
    }));
    const m = Object.fromEntries(entries);
    return { id: d.id, live: Object.values(m).some((v) => v != null), stats: { impressionCount: m.IMPRESSION, reachedCount: m.MEMBERS_REACHED, likeCount: m.REACTION, commentCount: m.COMMENT, shareCount: m.RESHARE, clickCount: m.LINK_CLICKS } };
  };
  const posts = [];
  for (let i = 0; i < published.length; i += POST_BATCH) posts.push(...(await Promise.all(published.slice(i, i + POST_BATCH).map(fetchPost))));
  return { aggregate, posts, published };
}

// Un passage par jour et par compte. Renvoie { skipped: true, snapshot } (déjà fait aujourd'hui), { snapshot } (fait maintenant) ou { error, status }.
export function captureProfileStats(userId) {
  if (inFlight.has(userId)) return inFlight.get(userId);
  const p = (async () => {
    const day = utcDay();
    const done = await prisma.statSnapshot.findFirst({ where: { userId, day, detailed: true } });
    if (done) return { skipped: true, snapshot: done };
    const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { statsToken: true, statsExpiresAt: true } });
    const token = decryptToken(acc?.statsToken);
    if (!token) return { error: "Statistiques du profil non connectées.", status: 404 };
    if (acc.statsExpiresAt && acc.statsExpiresAt < new Date()) return { error: "Session expirée.", status: 401 };
    if (memberQuotaPaused(token)) return { error: "Quota quotidien LinkedIn atteint.", status: 429 };
    let res;
    try { res = await readFromLinkedIn(token, userId); } catch (e) { return { error: e.message, status: e.status ?? 500 }; }

    // Une mesure refusée pour un post (quota en cours de lecture…) garde la valeur du relevé précédent plutôt qu'un vide
    const prev = await prisma.statSnapshot.findFirst({ where: { userId, detailed: true }, orderBy: { day: "desc" } });
    const prevPosts = new Map((prev?.body?.posts ?? []).map((x) => [x.id, x]));
    const posts = res.posts.map(({ live, ...rest }) => (live ? rest : { ...(prevPosts.get(rest.id) ?? rest), stale: true }));
    const body = { aggregate: res.aggregate, posts };
    const a = res.aggregate;
    const data = { impressions: a.impressionCount, reactions: a.likeCount, comments: a.commentCount, shares: a.shareCount, clicks: a.clickCount, reached: a.reachedCount, body, detailed: true };
    const snapshot = await prisma.statSnapshot.upsert({ where: { userId_day: { userId, day } }, create: { userId, day, ...data }, update: data });

    // Mesures par post à J+1 et J+7 (sans appel de plus : ce sont les chiffres qu'on vient de lire)
    for (const d of res.published) {
      const live = res.posts.find((x) => x.id === d.id);
      if (!live?.live || !d.publishedAt) continue;
      const age = Date.now() - new Date(d.publishedAt).getTime();
      const have = new Set((await prisma.postPerformance.findMany({ where: { draftId: d.id }, select: { offsetHours: true } })).map((r) => r.offsetHours));
      const offset = OFFSETS_HOURS.find((o) => !have.has(o) && age >= o * 3600_000);
      if (!offset) continue;
      const s = live.stats;
      await prisma.postPerformance.create({ data: { draftId: d.id, offsetHours: offset, impressions: s.impressionCount, likes: s.likeCount, comments: s.commentCount, shares: s.shareCount, clicks: s.clickCount } }).catch((e) => { if (e.code !== "P2002") console.error("[profile-stats] mesure par post :", e.message); });
    }
    return { snapshot };
  })().finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}
