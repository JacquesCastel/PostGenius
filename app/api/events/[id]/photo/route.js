import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { saveImage } from "@/lib/image";
import { logUsage } from "@/lib/usage";
import { checkFeature } from "@/lib/gating";

// Reçoit une photo prise sur place et crée un post "en direct" de l'événement.
export const maxDuration = 60;

export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const feat = await checkFeature(userId, "events", "Le module Événements");
  if (!feat.ok) return NextResponse.json({ error: feat.error }, { status: 403 });

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.userId !== userId) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const { image } = await req.json();
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(image || "");
  if (!m) return NextResponse.json({ error: "Image invalide." }, { status: 400 });

  let saved;
  try {
    saved = await saveImage(m[1]);
  } catch {
    return NextResponse.json({ error: "Échec de l'enregistrement de la photo." }, { status: 500 });
  }

  // Légende : IA si dispo, sinon modèle simple
  let text = `🔴 En direct de ${event.name}${event.location ? ` — ${event.location}` : ""} ! Ravis d'y être, venez nous rencontrer. 👋`;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyName: true, tone: true, styleNotes: true },
      });
      const prompt = `Rédige un court post LinkedIn (3 à 4 phrases, ton ${user?.tone || "professionnel"}) publié EN DIRECT depuis l'événement "${event.name}"${event.location ? ` (${event.location})` : ""}, qui accompagne une photo prise sur place. Donne envie aux gens de venir nous rencontrer${user?.companyName ? `, au nom de ${user.companyName}` : ""}, avec 2-3 hashtags pertinents. ${user?.styleNotes ? `Consignes de style : ${user.styleNotes}.` : ""} Réponds UNIQUEMENT avec le texte du post.`;
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await aiRes.json();
      const t = data?.content?.[0]?.text?.trim();
      if (aiRes.ok && t) {
        text = t;
        logUsage(userId, {
          kind: "claude",
          context: "evenement-photo",
          inputTokens: data?.usage?.input_tokens ?? 0,
          outputTokens: data?.usage?.output_tokens ?? 0,
        });
      }
    } catch {
      /* on garde le modèle par défaut */
    }
  }

  const draft = await prisma.draft.create({
    data: {
      userId,
      type: "simple",
      theme: event.name,
      expertise: "",
      tone: "",
      maxChars: 1300,
      text,
      status: "à valider",
      target: "person",
      auto: true,
      eventId: event.id,
      imageUrl: saved.url,
    },
  });

  return NextResponse.json({ ok: true, draftId: draft.id });
}
