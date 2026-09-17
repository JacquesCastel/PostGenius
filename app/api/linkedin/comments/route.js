import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Commentaires sur les posts de page entreprise — Comments API LinkedIn
// (socialActions/comments), sous Community Management API, scopes
// r_organization_social_feed / w_organization_social_feed. Réservé aux
// posts publiés sur une page entreprise (target = urn:li:organization:ID) :
// pour le profil personnel, la lecture des commentaires (r_member_social_feed)
// est réservée par LinkedIn à une liste fermée de développeurs, donc non
// disponible ici — voir doc Comments API.
// https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api

function liHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

async function orgDraftAndToken(userId, draftId) {
  const draft = await prisma.draft.findFirst({ where: { id: draftId, userId } });
  if (!draft) return { error: "Post introuvable.", status: 404 };
  if (!draft.postId) return { error: "Ce post n'a pas encore été publié.", status: 400 };
  if (!draft.target?.startsWith("urn:li:organization:")) {
    return { error: "Les commentaires ne sont disponibles que pour les posts de page entreprise.", status: 400 };
  }
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.orgToken);
  if (!token) return { error: "Page entreprise non connectée.", status: 401 };
  if (acc.orgExpiresAt && acc.orgExpiresAt < new Date()) {
    return { error: "Session de la page entreprise expirée — reconnectez-la (onglet Profil).", status: 401 };
  }
  return { draft, token, actor: draft.target };
}

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const draftId = new URL(req.url).searchParams.get("draftId");
  if (!draftId) return NextResponse.json({ error: "draftId requis." }, { status: 400 });

  const { draft, token, error, status } = await orgDraftAndToken(userId, draftId);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const res = await fetch(
      `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(draft.postId)}/comments`,
      { headers: liHeaders(token) }
    );
    if (!res.ok) {
      const raw = await res.text();
      console.error("LinkedIn comments GET:", res.status, raw);
      if (res.status === 401) return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez la page entreprise." }, { status: 401 });
      if (res.status === 403) return NextResponse.json({ error: "LinkedIn refuse l'accès aux commentaires (permission pas encore approuvée sur cette app)." }, { status: 403 });
      return NextResponse.json({ error: `LinkedIn a refusé la demande (${res.status}).` }, { status: 502 });
    }
    const data = await res.json();
    const comments = (data.elements ?? []).map((c) => ({
      id: c.id,
      commentUrn: c.commentUrn,
      text: c.message?.text ?? "",
      authorUrn: c.actor,
      authorName: c["actor~"]
        ? [c["actor~"].localizedFirstName, c["actor~"].localizedLastName].filter(Boolean).join(" ")
        : null,
      createdAt: c.created?.time ? new Date(c.created.time).toISOString() : null,
      likeCount: c.likesSummary?.totalLikes ?? 0,
    }));
    return NextResponse.json({ comments });
  } catch (e) {
    console.error("Erreur récupération commentaires:", e);
    return NextResponse.json({ error: "Échec de la récupération des commentaires." }, { status: 500 });
  }
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { draftId, text, parentCommentUrn } = await req.json();
  if (!draftId || !text?.trim()) return NextResponse.json({ error: "draftId et texte requis." }, { status: 400 });

  const { draft, token, actor, error, status } = await orgDraftAndToken(userId, draftId);
  if (error) return NextResponse.json({ error }, { status });

  const body = {
    actor,
    object: draft.postId,
    message: { text: text.trim().slice(0, 1250) },
    ...(parentCommentUrn ? { parentComment: parentCommentUrn } : {}),
  };

  try {
    const res = await fetch(
      `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(draft.postId)}/comments`,
      { method: "POST", headers: liHeaders(token), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const raw = await res.text();
      console.error("LinkedIn comments POST:", res.status, raw);
      if (res.status === 429) return NextResponse.json({ error: "Trop de commentaires envoyés — réessayez dans une minute." }, { status: 429 });
      return NextResponse.json({ error: `LinkedIn a refusé l'envoi (${res.status}).` }, { status: 502 });
    }
    const created = await res.json();
    return NextResponse.json({
      comment: {
        id: created.id,
        commentUrn: created.commentUrn,
        text: created.message?.text ?? text.trim(),
        authorUrn: created.actor,
        authorName: null,
        createdAt: created.created?.time ? new Date(created.created.time).toISOString() : new Date().toISOString(),
        likeCount: 0,
      },
    });
  } catch (e) {
    console.error("Erreur envoi commentaire:", e);
    return NextResponse.json({ error: "Échec de l'envoi de la réponse." }, { status: 500 });
  }
}
