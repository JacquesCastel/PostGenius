// Statistiques LinkedIn (impressions, réactions, commentaires, partages...) d'un lot
// de posts d'une page entreprise — API organizationalEntityShareStatistics
// (Community Management API). Utilisé par app/api/linkedin/stats/route.js (affichage)
// et lib/editorial/performance.js (capture d'historique).

const BASE = "https://api.linkedin.com/rest/organizationalEntityShareStatistics";

function liHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

// Renvoie { [urn]: totalShareStatistics }. L'API accepte au plus 10 URNs par appel
// (List()) : découpé en lots ici, un lot en échec n'empêche pas les autres.
export async function fetchOrgShareStats(orgToken, org, urns) {
  const statsByUrn = {};
  for (let i = 0; i < urns.length; i += 10) {
    const batch = urns.slice(i, i + 10);
    const shares = batch.filter((u) => u.startsWith("urn:li:share:"));
    const ugc = batch.filter((u) => u.startsWith("urn:li:ugcPost:"));
    const params = [`q=organizationalEntity`, `organizationalEntity=${encodeURIComponent(org)}`];
    if (shares.length) params.push(`shares=List(${shares.map(encodeURIComponent).join(",")})`);
    if (ugc.length) params.push(`ugcPosts=List(${ugc.map(encodeURIComponent).join(",")})`);

    const res = await fetch(`${BASE}?${params.join("&")}`, { headers: liHeaders(orgToken) });
    if (!res.ok) {
      console.error("fetchOrgShareStats:", res.status, await res.text());
      continue;
    }
    const data = await res.json();
    for (const el of data.elements ?? []) {
      const urn = el.share ?? el.ugcPost;
      if (urn) statsByUrn[urn] = el.totalShareStatistics;
    }
  }
  return statsByUrn;
}
