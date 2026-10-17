import { normalizeCommentUrn } from "./linkedinPost";
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

// Rest.li 2.0 : dans le chemin, un URN composite (commentaire) doit aussi avoir ses parenthèses encodées (encodeURIComponent les laisse)
const encUrn = (u) => encodeURIComponent(u).replace(/\(/g, "%28").replace(/\)/g, "%29");

export async function sendComment({ token, actor, urn, text, parentCommentUrn }) {
  const body = {
    actor,
    object: urn,
    message: { text },
    ...(parentCommentUrn ? { parentComment: parentCommentUrn } : {}),
  };
  // Réponse à un commentaire : la cible est le commentaire parent (documentation LinkedIn) ; si LinkedIn la refuse (400),
  // on retente avec le post pour cible et parentComment dans le corps
  const targets = parentCommentUrn ? [parentCommentUrn, urn] : [urn];
  let last;
  for (let i = 0; i < targets.length; i++) {
    const path = `/socialActions/${encUrn(targets[i])}/comments`;
    let res = await fetch(`${LI_API}/rest${path}`, { method: "POST", headers: restHeaders(token), body: JSON.stringify(body) });
    let via = "rest";
    if (await isPartnerDenied(res)) {
      res = await fetch(`${LI_API}/v2${path}`, { method: "POST", headers: v2Headers(token), body: JSON.stringify(body) });
      via = "v2";
    }
    last = { res, via };
    if (res.status !== 400 || i === targets.length - 1) return last;
  }
  return last;
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

// Compteurs d'un post (réactions, commentaires) par l'ancienne API v2 :
//   GET /v2/socialActions/{urn} -> { likesSummary: { totalLikes }, commentsSummary: { totalFirstLevelComments } }
// Ouverte ou non selon l'application : on renvoie { ok: false, status } sans lever d'erreur.
export async function getSocialSummary({ token, urn }) {
  try {
    const res = await fetch(`${LI_API}/v2/socialActions/${encodeURIComponent(urn)}`, { headers: v2Headers(token) });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    return {
      ok: true,
      reactions: num(j.likesSummary?.totalLikes ?? j.likesSummary?.aggregatedTotalLikes),
      comments: num(j.commentsSummary?.totalFirstLevelComments ?? j.commentsSummary?.aggregatedTotalComments),
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

// Texte d'un commentaire (Comments API : GET socialActions/{fil}/comments/{id}, sinon lecture de la liste du fil).
// commentUrn = urn:li:comment:(urn:li:activity:123,456). Renvoie { text, actor, at, parent } ou { status } (dernier refus de LinkedIn).
export async function getCommentText({ token, commentUrn }) {
  commentUrn = normalizeCommentUrn(commentUrn);
  const m = /^urn:li:comment:\((urn:li:(?:activity|share|ugcPost):\d+),(\d+)\)$/.exec(String(commentUrn));
  if (!m) return { status: 0 };
  const read = (j) => ({ text: String(j?.message?.text ?? ""), actor: j?.actor ?? null, at: j?.created?.time ?? null, parent: j?.parentComment ?? null });
  let status = 0;
  const get = async (path) => {
    try {
      const res = await fetch(`${LI_API}${path}`, { headers: restHeaders(token), signal: AbortSignal.timeout(8000) });
      status = res.status;
      return res.ok ? await res.json() : null;
    } catch {
      status = 0;
      return null;
    }
  };
  const base = `/rest/socialActions/${encodeURIComponent(m[1])}/comments`;
  const one = await get(`${base}/${m[2]}`);
  if (one?.message) return read(one);
  // Repli : la liste des commentaires du fil (c'est ce que lit l'écran « Commentaires » des posts publiés)
  const list = await get(`${base}?count=100`);
  const found = (list?.elements ?? []).find((c) => String(c.id) === m[2] || c.commentUrn === commentUrn);
  return found ? read(found) : { status };
}
