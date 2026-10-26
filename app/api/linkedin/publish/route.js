import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { publishForUser } from "@/lib/publish";
import { parseMentions } from "@/lib/mentions";
import { checkFeature, limitBody } from "@/lib/gating";

// Publication manuelle immédiate (bouton « Publier sur LinkedIn »).
// La logique LinkedIn est dans lib/publish.js, partagée avec le cron.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const { text, author, imageUrl, videoUrl, youtubeUrl, mentions, poll, documentSlides, documentTitle, firstComment } = await req.json();

  // Publication sur une page entreprise (URN organization) : réservée à l'offre Agence
  if (typeof author === "string" && author.includes("organization")) {
    const feat = await checkFeature(userId, "orgPublish", "La publication sur page entreprise");
    if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  }

  try {
    const { postId, mentionsDropped, personMentionsSkipped, firstComment: fc } = await publishForUser(userId, { text, author, imageUrl, videoUrl, youtubeUrl, mentions: parseMentions(mentions), poll, documentSlides, documentTitle, firstComment });
    const warning = [
      personMentionsSkipped ? "Les personnes mentionnées ne sont pas taguées : pour un post de profil, connectez votre profil dans « Connexions » (mentions de personnes), ou utilisez « Taguer dans LinkedIn »."
        : mentionsDropped ? "LinkedIn a refusé la mention : le post est publié sans mention. Taguez la page à la main sur LinkedIn." : null,
      fc && !fc.ok ? `le premier commentaire n'a pas pu être publié (${fc.error ?? "erreur LinkedIn"}) Ajoutez-le à la main sur LinkedIn.` : null,
    ].filter(Boolean).join(" ");
    return NextResponse.json({ ok: true, postId, ...(fc?.ok ? { firstCommentSent: true } : {}), ...(warning ? { warning } : {}) });
  } catch (e) {
    const msg = e.message || "Échec de la publication.";
    const status = /non connecté|expiré|reconnectez/i.test(msg) ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
