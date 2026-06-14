import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { logUsage } from "@/lib/usage";
import { checkFeature } from "@/lib/gating";

export const maxDuration = 120;

const fmtFr = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

// Place une date à l'heure de publication préférée (ex "09:00")
function atTime(date, publishTime) {
  const d = new Date(date);
  const [h, m] = (publishTime || "09:00").split(":").map(Number);
  d.setHours(h || 9, m || 0, 0, 0);
  return d;
}

export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Clé IA manquante." }, { status: 500 });

  const feat = await checkFeature(userId, "events", "Le module Événements");
  if (!feat.ok) return NextResponse.json({ error: feat.error }, { status: 403 });

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.userId !== userId)
    return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      headline: true, companyName: true, businessDescription: true, targetAudience: true,
      market: true, styleNotes: true, tone: true, defaultMaxChars: true, publishTime: true,
      requireValidation: true,
    },
  });

  const profileSpec = [
    user?.headline && `- Auteur : ${user.headline}`,
    user?.companyName && `- Entreprise / marque : ${user.companyName}`,
    user?.businessDescription && `- Activité : ${user.businessDescription}`,
    user?.targetAudience && `- Cible : ${user.targetAudience}`,
    user?.tone && `- Ton : ${user.tone}`,
    user?.styleNotes && `- Consignes de style (À RESPECTER) : ${user.styleNotes}`,
  ].filter(Boolean).join("\n");

  const sameDay = new Date(event.startDate).toDateString() === new Date(event.endDate).toDateString();
  const periode = sameDay ? `le ${fmtFr(event.startDate)}` : `du ${fmtFr(event.startDate)} au ${fmtFr(event.endDate)}`;

  const prompt = `Tu rédiges des posts LinkedIn pour annoncer la présence d'un professionnel à un événement.

Événement : "${event.name}"
${event.location ? `Lieu / stand : ${event.location}` : ""}
Période : ${periode}
${event.url ? `Lien : ${event.url}` : ""}
${event.details ? `Contexte de l'événement : ${event.details.slice(0, 1000)}` : ""}

Profil de l'auteur :
${profileSpec || "(non renseigné)"}

Génère 2 posts LinkedIn en français, dans le style de l'auteur, courts (accroche forte, 2 à 4 phrases aérées, 2-3 hashtags, et le lien de l'événement s'il existe) :
1. "annonce" — à publier quelques jours AVANT : nous serons présents à ${event.name} ${periode}, venez nous rencontrer.
2. "jourJ" — à publier LE JOUR de l'ouverture : nous y sommes, retrouvez-nous${event.location ? ` (${event.location})` : ""}, n'oubliez pas que nous sommes à ${event.name}${sameDay ? "" : ` jusqu'à la fin ${fmtFr(event.endDate)}`}.

Réponds UNIQUEMENT en JSON valide :
{"posts":[{"kind":"annonce","text":"..."},{"kind":"jourJ","text":"..."}]}`;

  let data;
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    data = await aiRes.json();
    if (!aiRes.ok) throw new Error("api");
  } catch {
    return NextResponse.json({ error: "La génération IA a échoué." }, { status: 502 });
  }

  let posts;
  try {
    posts = JSON.parse((data?.content?.[0]?.text || "").replace(/```json|```/g, "").trim()).posts;
    if (!Array.isArray(posts)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Format IA inexploitable." }, { status: 502 });
  }

  logUsage(userId, {
    kind: "claude", context: "evenement",
    inputTokens: data?.usage?.input_tokens ?? 0, outputTokens: data?.usage?.output_tokens ?? 0,
  });

  // Dates de programmation
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60 * 1000); // dans 1 h
  let annonceDate = atTime(new Date(new Date(event.startDate).getTime() - 3 * 86400000), user?.publishTime);
  if (annonceDate < soon) annonceDate = soon;
  let jourJDate = atTime(event.startDate, user?.publishTime);
  if (jourJDate < soon) jourJDate = new Date(soon.getTime() + 60 * 60 * 1000);

  const status = user?.requireValidation ? "à valider" : "programmé";
  const maxChars = user?.defaultMaxChars ?? 1300;

  const created = [];
  for (const p of posts) {
    if (!p?.text?.trim()) continue;
    const scheduledAt = p.kind === "jourJ" ? jourJDate : annonceDate;
    const draft = await prisma.draft.create({
      data: {
        userId,
        type: "simple",
        theme: event.name,
        expertise: "",
        tone: user?.tone || "",
        maxChars,
        text: p.text.trim(),
        status,
        scheduledAt,
        target: "person",
        auto: true,
        eventId: event.id,
        imageUrl: event.imageUrl || null,
      },
    });
    created.push(draft.id);
  }

  return NextResponse.json({ ok: true, count: created.length });
}
