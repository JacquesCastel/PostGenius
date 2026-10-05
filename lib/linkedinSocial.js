// Commenter et réagir sur LinkedIn, au nom d'un membre.
// 1) API versionnée (/rest/…, en-tête LinkedIn-Version) : service « partnerApiSocialActions »,
//    réservé aux applications avec la Community Management API.
// 2) Si LinkedIn répond 403 « partnerApi… », repli sur l'ancienne API v2 (/v2/socialActions),
//    ouverte avec « Share on LinkedIn » (w_member_social) : commentaires, et « J'aime » seulement
//    (l'ancienne API ne connaît pas les autres réactions).
// Renvoie { res, via } (res = Response de fetch) ou { unsupported: true } quand la réaction
// demandée n'existe pas dans l'ancienne API.

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";

const restHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
});
const v2Headers = (token) => ({
  Authorization: `Bearer ${token}`,
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
});

// Un refus de type « produit partenaire manquant » (et non un post privé, une session expirée…)
async function isPartnerDenied(res) {
  if (res.status !== 403) return false;
  try {
    return /partnerApi/i.test(await res.clone().text());
  } catch {
    return false;
  }
}

export async function sendComment({ token, actor, urn, text, parentCommentUrn }) {
  const body = {
    actor,
    object: urn,
    message: { text },
    ...(parentCommentUrn ? { parentComment: parentCommentUrn } : {}),
  };
  const path = `/socialActions/${encodeURIComponent(urn)}/comments`;
  const res = await fetch(`${LI_API}/rest${path}`, { method: "POST", headers: restHeaders(token), body: JSON.stringify(body) });
  if (!(await isPartnerDenied(res))) return { res, via: "rest" };
  const legacy = await fetch(`${LI_API}/v2${path}`, { method: "POST", headers: v2Headers(token), body: JSON.stringify(body) });
  return { res: legacy, via: "v2" };
}

export async function sendReaction({ token, actor, urn, reactionType }) {
  const res = await fetch(`${LI_API}/rest/reactions?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: restHeaders(token),
    body: JSON.stringify({ root: urn, reactionType }),
  });
  if (!(await isPartnerDenied(res))) return { res, via: "rest" };
  if (reactionType !== "LIKE") return { res, unsupported: true, via: "rest" };
  const legacy = await fetch(`${LI_API}/v2/socialActions/${encodeURIComponent(urn)}/likes`, {
    method: "POST",
    headers: v2Headers(token),
    body: JSON.stringify({ actor, object: urn }),
  });
  return { res: legacy, via: "v2" };
}
