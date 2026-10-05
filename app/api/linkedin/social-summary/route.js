import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { getSocialSummary } from "@/lib/linkedinSocial";

// Compteurs de réactions et de commentaires des derniers posts publiés sur le PROFIL
// PERSONNEL (l'API des statistiques de page ne couvre pas le profil). Essai par l'ancienne
// API v2 : si LinkedIn refuse à l'application, on le dit au lieu d'afficher des zéros.
// Les posts de page entreprise ont leurs propres statistiques (route /api/linkedin/stats).
// Cache de 5 minutes par compte : ménage le quota d'appels LinkedIn.

const MAX_POSTS = 10;
const TTL = 5 * 60_000;
const cache = new Map(); // userId -> { at, body }

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.personToken);
  if (!token || (acc.personExpiresAt && acc.personExpiresAt < new Date())) {
    return NextResponse.json({ posts: {}, unavailable: "not_connected" });
  }

  const drafts = await prisma.draft.findMany({
    where: { userId, status: "publié", target: "person", postId: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: MAX_POSTS,
    select: { id: true, postId: true },
  });

  const posts = {};
  let denied = null;
  // Par petits lots ; au premier refus d'accès (403/401), inutile d'insister sur les autres
  for (let i = 0; i < drafts.length && !denied; i += 3) {
    const batch = drafts.slice(i, i + 3);
    const results = await Promise.all(batch.map((d) => getSocialSummary({ token, urn: d.postId })));
    results.forEach((r, k) => {
      if (r.ok) posts[batch[k].id] = { reactions: r.reactions, comments: r.comments };
      else if (r.status === 403 || r.status === 401) denied = r.status;
    });
  }

  const body = { posts, unavailable: denied && Object.keys(posts).length === 0 ? "denied" : null };
  cache.set(userId, { at: Date.now(), body });
  return NextResponse.json(body);
}
