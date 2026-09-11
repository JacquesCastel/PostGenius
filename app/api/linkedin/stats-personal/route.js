import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Statistiques du profil personnel — API officielle LinkedIn memberCreatorPostAnalytics
// (remplace Phyllo). Permission requise : r_member_postAnalytics, disponible
// uniquement sous le produit Community Management API — qui doit être seul
// produit sur son app LinkedIn (incompatible avec Share on LinkedIn / Sign In).
// On utilise donc le token de l'app n°2 (orgToken, /api/linkedin/auth-org) :
// c'est le même utilisateur LinkedIn, juste un token obtenu via l'autre app.
// Doc : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics

const BASE = "https://api.linkedin.com/rest/memberCreatorPostAnalytics";
const AGGREGATE_METRICS = ["IMPRESSION", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS"];
const PER_POST_METRICS = ["IMPRESSION", "REACTION", "COMMENT", "RESHARE"];
const MAX_POSTS = 10; // limite le nombre d'appels (quota LinkedIn par membre)

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

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.orgToken);
  if (!token) return NextResponse.json({ connected: false });
  if (acc.orgExpiresAt && acc.orgExpiresAt < new Date()) {
    return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez votre compte (onglet Profil, section Page entreprise)." }, { status: 401 });
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
    };

    // 2) Statistiques par post (posts publiés via l'app sur le profil personnel)
    const published = await prisma.draft.findMany({
      where: { userId, status: "publié", target: "person", postId: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: MAX_POSTS,
    });

    const posts = await Promise.all(
      published.map(async (d) => {
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
            likeCount: m.REACTION,
            commentCount: m.COMMENT,
            shareCount: m.RESHARE,
            clickCount: null,
          },
        };
      })
    );

    return NextResponse.json({ connected: true, aggregate, posts });
  } catch (e) {
    console.error("Erreur stats profil personnel:", e);
    if (e.status === 403) {
      return NextResponse.json(
        { error: "LinkedIn refuse l'accès aux statistiques (permission r_member_postAnalytics manquante ou pas encore approuvée sur l'app Page entreprise)." },
        { status: 403 }
      );
    }
    if (e.status === 401) {
      return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez votre compte (onglet Profil, section Page entreprise)." }, { status: 401 });
    }
    return NextResponse.json({ error: "Échec de la récupération des statistiques." }, { status: 500 });
  }
}
