import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { fetchMemberMetric, memberQuotaPaused } from "@/lib/linkedin/memberStats";

// Statistiques du profil personnel — API officielle LinkedIn memberCreatorPostAnalytics
// (remplace Phyllo). Permission requise : r_member_postAnalytics, disponible
// uniquement sous le produit Community Management API — qui doit être seul
// produit sur son app LinkedIn (incompatible avec Share on LinkedIn / Sign In).
// On utilise donc le token de l'app dédiée "PostGenius Stats" (statsToken,
// /api/linkedin/auth-stats), séparée de l'app "Post" (pages entreprise) pour
// ne pas lier les statistiques du profil perso à la connexion page entreprise.
// Doc : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics

// Totaux de tous les posts du membre (finder « me ») : 1 appel par mesure
const AGGREGATE_METRICS = [
  "IMPRESSION", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS",
  "MEMBERS_REACHED", "POST_SAVE", "POST_SEND", "FOLLOWER_GAINED_FROM_CONTENT", "PROFILE_VIEW_FROM_CONTENT",
];
// Par post (finder « entity ») : 6 appels par post, donc au plus 60 pour 10 posts
const PER_POST_METRICS = ["IMPRESSION", "MEMBERS_REACHED", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS"];
const MAX_POSTS = 10; // limite le nombre d'appels (quota LinkedIn par membre)
const POST_BATCH = 3; // posts interrogés en parallèle (18 appels simultanés au plus)
const CACHE_TTL = 30 * 60_000; // 30 min par compte : un affichage coûte jusqu'à 70 appels, et LinkedIn n'en accorde qu'environ 100 par jour
const cache = new Map(); // userId -> { at, body }

// Une mesure ; en cas d'échec on garde le code (429 : quota du jour de LinkedIn) pour l'expliquer à l'utilisateur
const fetchMetric = (token, args) => fetchMemberMetric(token, { entity: args.entity, queryType: args.queryType });

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL && !new URL(req.url).searchParams.has("refresh")) {
    return NextResponse.json(hit.body);
  }

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.statsToken);
  if (!token) return NextResponse.json({ connected: false });
  if (acc.statsExpiresAt && acc.statsExpiresAt < new Date()) {
    return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez les statistiques du profil (menu « Connexions »)." }, { status: 401 });
  }

  try {
    // 1) Statistiques agrégées (toutes les publications du membre, à vie)
    // Chaque métrique est indépendante : une seule indisponible (ex. LINK_CLICKS
    // sur certains tiers) ne doit pas faire disparaître les autres.
    const aggResults = await Promise.all(
      AGGREGATE_METRICS.map(async (queryType) => {
        try {
          return [queryType, await fetchMetric(token, { queryType }), null];
        } catch (e) {
          return [queryType, null, e.status ?? 500];
        }
      })
    );
    const agg = Object.fromEntries(aggResults.map(([k, v]) => [k, v]));
    const statuses = aggResults.map(([, , status]) => status).filter(Boolean);

    // Si TOUTES les métriques échouent avec le même statut, c'est un problème
    // systémique (permission manquante ou session expirée) : on le remonte.
    if (statuses.length === AGGREGATE_METRICS.length) {
      const err = new Error("Toutes les métriques ont échoué.");
      err.status = statuses.includes(401) ? 401 : statuses.every((s) => s === 403) ? 403 : statuses[0];
      throw err;
    }

    const aggregate = {
      impressionCount: agg.IMPRESSION,
      likeCount: agg.REACTION,
      commentCount: agg.COMMENT,
      shareCount: agg.RESHARE,
      clickCount: agg.LINK_CLICKS,
      reachedCount: agg.MEMBERS_REACHED,
      saveCount: agg.POST_SAVE,
      sendCount: agg.POST_SEND,
      followerCount: agg.FOLLOWER_GAINED_FROM_CONTENT,
      profileViewCount: agg.PROFILE_VIEW_FROM_CONTENT,
    };

    // 2) Statistiques par post (posts publiés via l'app sur le profil personnel)
    const published = await prisma.draft.findMany({
      where: { userId, status: "publié", target: "person", postId: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: MAX_POSTS,
    });

    let throttled = statuses.includes(429);
    // Dernière mesure enregistrée de chaque post (J+1 ou J+7) : sert quand LinkedIn refuse la mesure du jour
    const saved = new Map();
    for (const row of await prisma.postPerformance.findMany({ where: { draftId: { in: published.map((d) => d.id) } }, orderBy: { offsetHours: "asc" } })) saved.set(row.draftId, row);
    const fetchPost = async (d) => {
      const entries = await Promise.all(
        PER_POST_METRICS.map(async (queryType) => {
          try {
            return [queryType, await fetchMetric(token, { entity: d.postId, queryType })];
          } catch (e) {
            if (e.status === 429) throttled = true;
            return [queryType, null];
          }
        })
      );
      const m = Object.fromEntries(entries);
      const old = saved.get(d.id);
      const live = Object.values(m).some((v) => v != null);
      return {
        id: d.id,
        ...(live ? {} : old ? { fromSnapshot: true } : {}),
        stats: {
          impressionCount: m.IMPRESSION ?? old?.impressions ?? null,
          reachedCount: m.MEMBERS_REACHED,
          likeCount: m.REACTION ?? old?.likes ?? null,
          commentCount: m.COMMENT ?? old?.comments ?? null,
          shareCount: m.RESHARE ?? old?.shares ?? null,
          clickCount: m.LINK_CLICKS ?? old?.clicks ?? null,
        },
      };
    };
    // Par petits lots : ménage le quota de LinkedIn au lieu de lancer tous les appels d'un coup
    const posts = [];
    for (let i = 0; i < published.length; i += POST_BATCH) {
      posts.push(...(await Promise.all(published.slice(i, i + POST_BATCH).map(fetchPost))));
    }

    const body = { connected: true, aggregate, posts, ...(throttled || memberQuotaPaused(token) ? { quotaLimited: true } : {}) };
    // Un résultat dégradé par le quota n'est pas gardé longtemps en cache : on réessaiera dès que LinkedIn aura remis les compteurs à zéro
    if (!body.quotaLimited) cache.set(userId, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    console.error("Erreur stats profil personnel:", e);
    if (e.status === 429) {
      // Quota quotidien de LinkedIn atteint : on montre les dernières valeurs enregistrées plutôt qu'une erreur ou des tirets
      const snap = await prisma.statSnapshot.findFirst({ where: { userId }, orderBy: { day: "desc" } });
      const drafts = await prisma.draft.findMany({ where: { userId, status: "publié", target: "person", postId: { not: null } }, orderBy: { publishedAt: "desc" }, take: MAX_POSTS, include: { performance: { orderBy: { offsetHours: "asc" } } } });
      return NextResponse.json({
        connected: true,
        quotaLimited: true,
        aggregate: snap ? { impressionCount: snap.impressions, likeCount: snap.reactions, commentCount: snap.comments } : {},
        posts: drafts.map((d) => { const o = d.performance[d.performance.length - 1]; return { id: d.id, fromSnapshot: Boolean(o), stats: { impressionCount: o?.impressions ?? null, likeCount: o?.likes ?? null, commentCount: o?.comments ?? null, shareCount: o?.shares ?? null, clickCount: o?.clicks ?? null } }; }),
      });
    }
    if (e.status === 403) {
      return NextResponse.json(
        { error: "LinkedIn refuse l'accès aux statistiques (permission r_member_postAnalytics pas encore approuvée — en attente de revue LinkedIn)." },
        { status: 403 }
      );
    }
    if (e.status === 401) {
      return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez les statistiques du profil (menu « Connexions »)." }, { status: 401 });
    }
    return NextResponse.json({ error: "Échec de la récupération des statistiques." }, { status: 500 });
  }
}
