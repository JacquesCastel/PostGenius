import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { withDetail } from "@/lib/linkedinError";

// Commentaires d'un post publié — Comments API LinkedIn (socialActions/comments).
// - Page entreprise (target = urn:li:organization:ID) : Community Management API,
//   scopes r_organization_social_feed / w_organization_social_feed.
// - Profil personnel (target = "person") : la LECTURE exige r_member_social_feed,
//   que LinkedIn réserve à une liste fermée de développeurs. Tant que l'accès n'est
//   pas accordé à l'application, LinkedIn répond 403 et l'écran propose le lien vers
//   le post. Une fois accordé : ajouter le scope dans LINKEDIN_SCOPES et reconnecter
//   le compte, rien d'autre à changer. Répondre (écriture) relève de w_member_social.
// https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";

function liHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

async function draftAndToken(userId, draftId) {
  const draft = await prisma.draft.findFirst({ where: { id: draftId, userId } });
  if (!draft) return { error: "Post introuvable.", status: 404 };
  if (!draft.postId) return { error: "Ce post n'a pas encore été publié.", status: 400 };
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });

  if (draft.target?.startsWith("urn:li:organization:")) {
    const token = decryptToken(acc?.orgToken);
    if (!token) return { error: "Page entreprise non connectée.", status: 401 };
    if (acc.orgExpiresAt && acc.orgExpiresAt < new Date()) {
      return { error: "Session de la page entreprise expirée — reconnectez-la (onglet Profil).", status: 401 };
    }
    return { draft, token, actor: draft.target, personal: false };
  }

  const token = decryptToken(acc?.personToken);
  if (!token || !acc?.personSub) return { error: "Compte LinkedIn non connecté.", status: 401 };
  if (acc.personExpiresAt && acc.personExpiresAt < new Date()) {
    return { error: "Session LinkedIn expirée — reconnectez votre compte (onglet Profil).", status: 401 };
  }
  return { draft, token, actor: `urn:li:person:${acc.personSub}`, personal: true };
}

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const draftId = new URL(req.url).searchParams.get("draftId");
  if (!draftId) return NextResponse.json({ error: "draftId requis." }, { status: 400 });

  const { draft, token, personal, error, status } = await draftAndToken(userId, draftId);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const res = await fetch(
      `${LI_API}/rest/socialActions/${encodeURIComponent(draft.postId)}/comments`,
      { headers: liHeaders(token) }
    );
    if (!res.ok) {
      const raw = await res.text();
      console.error("LinkedIn comments GET:", res.status, raw);
      if (res.status === 401) return NextResponse.json({ error: "Session LinkedIn expirée — reconnectez la page entreprise." }, { status: 401 });
      if (res.status === 403) {
        // Code stable pour l'interface : elle propose alors le lien vers le post LinkedIn
        return NextResponse.json(
          {
            code: "read_forbidden",
            error: personal
              ? "LinkedIn n'autorise pas encore cette application à lire les commentaires de votre profil personnel."
              : "LinkedIn refuse l'accès aux commentaires (permission pas encore approuvée sur cette app).",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: withDetail(`LinkedIn a refusé la demande (${res.status}).`, raw) }, { status: 502 });
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

  const { draft, token, actor, error, status } = await draftAndToken(userId, draftId);
  if (error) return NextResponse.json({ error }, { status });

  const body = {
    actor,
    object: draft.postId,
    message: { text: text.trim().slice(0, 1250) },
    ...(parentCommentUrn ? { parentComment: parentCommentUrn } : {}),
  };

  try {
    const res = await fetch(
      `${LI_API}/rest/socialActions/${encodeURIComponent(draft.postId)}/comments`,
      { method: "POST", headers: liHeaders(token), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const raw = await res.text();
      console.error("LinkedIn comments POST:", res.status, raw);
      if (res.status === 429) return NextResponse.json({ error: "Trop de commentaires envoyés — réessayez dans une minute." }, { status: 429 });
      return NextResponse.json({ error: withDetail(`LinkedIn a refusé l'envoi (${res.status}).`, raw) }, { status: res.status === 403 ? 403 : 502 });
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
