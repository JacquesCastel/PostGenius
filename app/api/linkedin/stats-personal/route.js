import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Statistiques du profil personnel — API officielle LinkedIn memberCreatorPostAnalytics
// (remplace Phyllo). Permission requise : r_member_postAnalytics, disponible
// uniquement sous le produit Community Management API — qui doit être seul
// produit sur son app LinkedIn (incompatible avec Share on LinkedIn / Sign In).
// On utilise donc le token de l'app dédiée "PostGenius Stats" (statsToken,
// /api/linkedin/auth-stats), séparée de l'app "Post" (pages entreprise) pour
// ne pas lier les statistiques du profil perso à la connexion page entreprise.
// Doc : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics

const BASE = `${process.env.LINKEDIN_API_BASE || "https://api.linkedin.com"}/rest/memberCreatorPostAnalytics`;
// Totaux de tous les posts du membre (finder « me ») : 1 appel par mesure
const AGGREGATE_METRICS = [
  "IMPRESSION", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS",
  "MEMBERS_REACHED", "POST_SAVE", "POST_SEND", "FOLLOWER_GAINED_FROM_CONTENT", "PROFILE_VIEW_FROM_CONTENT",
];
// Par post (finder « entity ») : 6 appels par post, donc au plus 60 pour 10 posts
const PER_POST_METRICS = ["IMPRESSION", "MEMBERS_REACHED", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS"];
const MAX_POSTS = 10; // limite le nombre d'appels (quota LinkedIn par membre)
const POST_BATCH = 3; // posts interrogés en parallèle (18 appels simultanés au plus)
const CACHE_TTL = 10 * 60_000; // 10 min par compte : la page ne doit pas rejouer 70 appels à chaque ouverture
const cache = new Map(); // userId -> { at, body }

function liHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

// urn:li:share:123 → "(share:urn%3Ali%3Ashare%3A123)" ; urn:li:ugcPost:123 → "(ugc:...)"
function entityParam(urn) {
  const kind = urn.startsWith("urn:li:ugcPost:") ? "ugc" : "share";
  return `(${kind}:${encodeURIComponent(urn)})`;
}

async function fetchMetric(token, { entity, queryType, silent } = {}) {
  const params = entity
    ? `q=entity&entity=${entityParam(entity)}&queryType=${queryType}`
    : `q=me&queryType=${queryType}`;
  const res = await fetch(`${BASE}?${params}`, { headers: liHeaders(token) });
  if (!res.ok) {
    if (!silent) console.error("memberCreatorPostAnalytics", res.status, queryType, entity ?? "(me)", await res.text());
    const err = new Error(`LinkedIn a refusé la demande de statistiques (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.elements?.[0]?.count ?? 0;
}

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
          return [queryType, await fetchMetric(token, { queryType, silent: true }), null];
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

    const fetchPost = async (d) => {
      const entries = await Promise.all(
        PER_POST_METRICS.map(async (queryType) => {
          try {
            return [queryType, await fetchMetric(token, { entity: d.postId, queryType, silent: true })];
          } catch {
            return [queryType, null];
          }
        })
      );
      const m = Object.fromEntries(entries);
      return {
        id: d.id,
        stats: {
          impressionCount: m.IMPRESSION,
          reachedCount: m.MEMBERS_REACHED,
          likeCount: m.REACTION,
          commentCount: m.COMMENT,
          shareCount: m.RESHARE,
          clickCount: m.LINK_CLICKS,
        },
      };
    };
    // Par petits lots : ménage le quota de LinkedIn au lieu de lancer tous les appels d'un coup
    const posts = [];
    for (let i = 0; i < published.length; i += POST_BATCH) {
      posts.push(...(await Promise.all(published.slice(i, i + POST_BATCH).map(fetchPost))));
    }

    const body = { connected: true, aggregate, posts };
    cache.set(userId, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    console.error("Erreur stats profil personnel:", e);
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
