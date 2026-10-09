import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { videoPathFromUrl } from "@/lib/video";
import { parseYouTubeId, youtubeWatchUrl } from "@/lib/youtube";
import { parisDay } from "@/lib/campaignPlan";
import { sanitizeMentions } from "@/lib/mentions";

// PATCH : modifier texte/statut — DELETE : supprimer
// La clause where inclut toujours userId : un client ne touche que SES brouillons.

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const { text, status, postId, scheduledAt, target, imageUrl, imagePrompt, videoUrl, youtubeUrl, mentions } = await req.json();

  if (videoUrl) {
    try {
      videoPathFromUrl(videoUrl, userId);
    } catch {
      return NextResponse.json({ error: "Vidéo invalide." }, { status: 400 });
    }
  }

  if (youtubeUrl && !parseYouTubeId(youtubeUrl)) {
    return NextResponse.json({ error: "Lien YouTube invalide." }, { status: 400 });
  }

  // Programmation : date future obligatoire
  if (scheduledAt !== undefined && scheduledAt !== null) {
    const d = new Date(scheduledAt);
    if (isNaN(d) || d <= new Date()) {
      return NextResponse.json({ error: "La date de programmation doit être dans le futur." }, { status: 400 });
    }
  }
  if (target !== undefined && target !== "person" && !/^urn:li:organization:\d+$/.test(target)) {
    return NextResponse.json({ error: "Compte de publication invalide." }, { status: 400 });
  }

  const { count } = await prisma.draft.updateMany({
    where: { id, userId },
    data: {
      ...(text !== undefined && { text }),
      ...(status !== undefined && { status }),
      ...(postId !== undefined && { postId }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
      ...(target !== undefined && { target }),
      ...(mentions !== undefined && { mentions: mentions === null ? null : JSON.stringify(sanitizeMentions(typeof mentions === "string" ? (() => { try { return JSON.parse(mentions); } catch { return []; } })() : mentions)) }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(imagePrompt !== undefined && { imagePrompt }),
      ...(videoUrl !== undefined && { videoUrl }),
      ...(youtubeUrl !== undefined && { youtubeUrl: youtubeUrl ? youtubeWatchUrl(parseYouTubeId(youtubeUrl)) : null }),
      // Le message d'échec ne vaut plus dès que le post repart sur une autre voie (brouillon, validé, reprogrammé)
      ...(status !== undefined && status !== "erreur" && { publishError: null }),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Brouillon introuvable." }, { status: 404 });
  // Post issu du plan éditorial d'une campagne : déplacé dans le calendrier, la ligne du plan suit
  if (scheduledAt) {
    const d = await prisma.draft.findFirst({ where: { id, userId }, select: { campaignPostId: true } });
    if (d?.campaignPostId) await prisma.campaignPost.update({ where: { id: d.campaignPostId }, data: { date: parisDay(new Date(scheduledAt)) } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.draft.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Brouillon introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
