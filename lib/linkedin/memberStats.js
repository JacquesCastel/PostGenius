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

// Quota quotidien de LinkedIn (palier Development : environ 100 appels par jour et par membre, 500 par application) : sur un 429, plus aucun
// appel pour ce jeton jusqu'à minuit UTC (remise à zéro des compteurs), au lieu de multiplier les refus et d'afficher des tirets partout.
const pausedUntil = new Map(); // fin de la clé du jeton → ms
const keyOf = (t) => String(t).slice(-16);
const nextMidnightUtc = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
export const memberQuotaPaused = (token) => (pausedUntil.get(keyOf(token)) ?? 0) > Date.now();

// Une mesure : { entity } pour un post, sans entity pour le total du membre. Renvoie un nombre, ou lève une erreur portant `status`.
export async function fetchMemberMetric(token, { entity, queryType }) {
  if (memberQuotaPaused(token)) { const err = new Error("Quota quotidien LinkedIn atteint."); err.status = 429; throw err; }
  const params = entity ? `q=entity&entity=${entityParam(entity)}&queryType=${queryType}` : `q=me&queryType=${queryType}`;
  const res = await fetch(`${BASE}?${params}`, { headers: headers(token), signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (res.status === 429) { pausedUntil.set(keyOf(token), nextMidnightUtc()); console.warn("[member-stats] LinkedIn a répondu 429 : quota d'appels du jour atteint, reprise à minuit UTC"); }
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
