import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { chatRefine } from "@/lib/editorial/chat";
import { logUsage } from "@/lib/usage";

export const maxDuration = 60;

// Échange conversationnel affinant lib/editorial/chat.js — chaque réponse
// peut mettre à jour User.editorialNote (persisté), sans jamais régénérer
// les recommandations automatiquement : ça reste une action explicite
// côté client, pour ne pas multiplier les appels IA à chaque message.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: "Message requis." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

  try {
    const { reply, note, usage } = await chatRefine({ user, messages: messages.slice(-12) });
    logUsage(userId, {
      context: "chat copilote éditorial",
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
    });

    let editorialNote = user.editorialNote ?? null;
    if (note && note.trim() && note.trim() !== editorialNote) {
      editorialNote = note.trim().slice(0, 500);
      await prisma.user.update({ where: { id: userId }, data: { editorialNote } });
    }

    return NextResponse.json({ reply, editorialNote });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur du copilote." }, { status: 502 });
  }
}
