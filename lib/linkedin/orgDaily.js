import { fetchOrgShareStats } from "./orgShareStats";

// Résultats d'une page entreprise sur 60 jours, jour par jour — organizationalEntityShareStatistics avec timeIntervals (granularité DAY).
// Un seul appel pour la série + un pour les posts des 30 derniers jours. Gardé 6 h en mémoire : ouvrir le tableau de bord ne sollicite pas
// LinkedIn à chaque fois ; si LinkedIn refuse (quota…), on sert la dernière série connue plutôt qu'un vide.

const TTL_MS = 6 * 3600_000;
const cache = new Map(); // `${userId}|${org}` → { at, value }

const liHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
  "X-Restli-Protocol-Version": "2.0.0",
});

const utcMidnight = (offsetDays = 0) => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays); };

async function readDaily(token, org) {
  const start = utcMidnight(-60), end = utcMidnight(0);
  const url = `${process.env.LINKEDIN_API_BASE || "https://api.linkedin.com"}/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(org)}&timeIntervals=(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
  const res = await fetch(url, { headers: liHeaders(token), signal: AbortSignal.timeout(15000) });
  if (!res.ok) { const err = new Error(`LinkedIn a refusé la demande de statistiques (${res.status}).`); err.status = res.status; throw err; }
  const data = await res.json();
  const daily = { IMPRESSION: {}, REACTION: {}, COMMENT: {} };
  for (const el of data.elements ?? []) {
    const t = el.timeRange?.start;
    if (t == null) continue;
    const day = new Date(t).toISOString().slice(0, 10);
    const s = el.totalShareStatistics ?? {};
    daily.IMPRESSION[day] = s.impressionCount ?? 0;
    daily.REACTION[day] = s.likeCount ?? 0;
    daily.COMMENT[day] = s.commentCount ?? 0;
  }
  return daily;
}

// drafts : posts publiés sur cette page depuis 30 jours ({ id, theme, postId, publishedAt }). Renvoie { daily, best } ou lève une erreur portant `status`.
export async function pageResults(userId, token, org, drafts) {
  const key = `${userId}|${org}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const daily = await readDaily(token, org);
    const urns = drafts.map((d) => d.postId).filter((id) => /^urn:li:(share|ugcPost):/.test(id ?? ""));
    const byUrn = urns.length ? await fetchOrgShareStats(token, org, urns) : {};
    let best = null;
    for (const d of drafts) {
      const s = byUrn[d.postId];
      if (!s) continue;
      const imp = s.impressionCount ?? 0;
      if (!best || imp > best.impressions) best = { id: d.id, theme: d.theme, publishedAt: d.publishedAt, impressions: imp, reactions: s.likeCount ?? 0, comments: s.commentCount ?? 0 };
    }
    const value = { daily, best, at: Date.now() };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return { ...hit.value, stale: true };
    throw e;
  }
}
