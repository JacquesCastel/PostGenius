import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { logUsage } from "@/lib/usage";
import { getRemarks } from "@/lib/remarks";
import { datalakeBlockFor } from "@/lib/datalakeBlock";
import { chatTurn, sanitizeRecoPatch, MAX_MESSAGE_CHARS } from "@/lib/editorial/chat";
import { getHistory, proposeFromChat, pendingChatSuggestions } from "@/lib/editorial/chatStore";

export const maxDuration = 60;

// Discussion avec le copilote éditorial, conservée d'une visite à l'autre.
// GET : l'historique et les consignes en attente de réponse.
// POST : un échange. Avec recoId, le client retravaille cette piste (elle est modifiée et enregistrée) ;
//        sans, la discussion est stratégique (la note du copilote peut être mise à jour). Le modèle
//        peut aussi proposer des consignes durables : elles deviennent des suggestions de remarques
//        que le client accepte ou ignore, jamais appliquées seules.
// DELETE : efface l'historique.

const RECO_SELECT = { pillar: { select: { id: true, name: true } } };

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const [messages, suggestions] = await Promise.all([getHistory(userId), pendingChatSuggestions(userId)]);
  return NextResponse.json({ messages, suggestions });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Copilote indisponible : clé IA manquante sur le serveur." }, { status: 500 });

  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!rateLimit(`copilot-chat:${userId}`, { limit: 30, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop de messages pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.replace(/\s+/g, " ").trim() : "";
  if (!message) return NextResponse.json({ error: "Message requis." }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) return NextResponse.json({ error: `Message trop long (${MAX_MESSAGE_CHARS} caractères maximum).` }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

  let reco = null;
  if (body.recoId != null) {
    reco = await prisma.editorialRecommendation.findFirst({ where: { id: String(body.recoId), userId, status: "proposée" }, include: RECO_SELECT });
    if (!reco) return NextResponse.json({ error: "Cette piste n'est plus disponible : elle a été traitée ou remplacée." }, { status: 409 });
  }

  try {
    const [history, remarks] = await Promise.all([getHistory(userId, 40), getRemarks(userId)]);
    const datalake = await datalakeBlockFor(userId, [reco?.topic, reco?.angle, message].filter(Boolean).join(" "));
    const out = await chatTurn({ user, history, message, reco, remarks, datalake });
    logUsage(userId, { context: "chat copilote éditorial", inputTokens: out.usage?.input_tokens ?? 0, outputTokens: out.usage?.output_tokens ?? 0 });

    // Piste retravaillée : seuls les champs réellement changés sont enregistrés
    let updated = null;
    let previous = null;
    if (reco && out.reco) {
      const patch = sanitizeRecoPatch(out.reco, reco);
      if (patch) {
        previous = { topic: reco.topic, angle: reco.angle, rationale: reco.rationale, hook: reco.hook, cta: reco.cta, objective: reco.objective, postType: reco.postType };
        updated = await prisma.editorialRecommendation.update({ where: { id: reco.id }, data: patch, include: RECO_SELECT });
      }
    }

    // Note du copilote (discussion stratégique)
    let editorialNote = user.editorialNote ?? null;
    if (out.note && out.note !== editorialNote) {
      editorialNote = out.note;
      await prisma.user.update({ where: { id: userId }, data: { editorialNote } });
    }

    await proposeFromChat(userId, out.remember).catch((e) => console.error("[copilote] suggestions :", e.message));

    // Les deux messages sont conservés ensemble ; l'horodatage de la réponse suit celui du message
    const now = Date.now();
    const recoTopic = reco ? reco.topic.slice(0, 160) : null;
    const [userMsg, assistantMsg] = await prisma.$transaction([
      prisma.copilotMessage.create({ data: { userId, role: "user", content: message, recoId: reco?.id ?? null, recoTopic, createdAt: new Date(now) }, select: { id: true, role: true, content: true, recoId: true, recoTopic: true, createdAt: true } }),
      prisma.copilotMessage.create({ data: { userId, role: "assistant", content: out.reply, recoId: reco?.id ?? null, recoTopic, createdAt: new Date(now + 1) }, select: { id: true, role: true, content: true, recoId: true, recoTopic: true, createdAt: true } }),
    ]);

    return NextResponse.json({
      messages: [userMsg, assistantMsg],
      reco: updated,
      previous,
      editorialNote,
      suggestions: await pendingChatSuggestions(userId),
    });
  } catch (e) {
    console.error("Erreur discussion copilote:", e.message);
    return NextResponse.json({ error: "Le copilote n'a pas pu répondre. Réessayez dans un instant." }, { status: 502 });
  }
}

export async function DELETE(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  await prisma.copilotMessage.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
