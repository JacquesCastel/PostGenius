// Statistiques du profil personnel — API memberCreatorPostAnalytics (permission r_member_postAnalytics, app « PostGenius Stats »).
// Partagé par l'écran « Statistiques » (app/api/linkedin/stats-personal), le relevé quotidien et les instantanés par post.
// Doc : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics

const BASE = `${process.env.LINKEDIN_API_BASE || "https://api.linkedin.com"}/rest/memberCreatorPostAnalytics`;

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
  "X-Restli-Protocol-Version": "2.0.0",
});

// urn:li:share:123 → "(share:urn%3Ali%3Ashare%3A123)" ; urn:li:ugcPost:123 → "(ugc:...)"
const entityParam = (urn) => `(${urn.startsWith("urn:li:ugcPost:") ? "ugc" : "share"}:${encodeURIComponent(urn)})`;

// Une mesure : { entity } pour un post, sans entity pour le total du membre. Renvoie un nombre, ou lève une erreur portant `status`.
export async function fetchMemberMetric(token, { entity, queryType }) {
  const params = entity ? `q=entity&entity=${entityParam(entity)}&queryType=${queryType}` : `q=me&queryType=${queryType}`;
  const res = await fetch(`${BASE}?${params}`, { headers: headers(token), signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const err = new Error(`LinkedIn a refusé la demande de statistiques (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.elements?.[0]?.count ?? 0;
}

// Plusieurs mesures indépendantes : une mesure indisponible donne null sans faire échouer les autres
export async function fetchMemberMetrics(token, types, { entity } = {}) {
  const out = {};
  await Promise.all(types.map(async (t) => { out[t] = await fetchMemberMetric(token, { entity, queryType: t }).catch(() => null); }));
  return out;
}
