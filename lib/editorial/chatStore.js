import { prisma } from "../db";
import { getRemarks } from "../remarks";
import { maxSemanticSimilarity } from "./embeddings";
import { MAX_PENDING, SAME_HABIT_SIMILARITY } from "../remarkSuggestions";

// Persistance de la discussion avec le copilote et passage des préférences repérées par la
// conversation dans le circuit d'apprentissage existant (RemarkSuggestion → PostRemark).

export const HISTORY_LIMIT = 60; // messages renvoyés à l'écran

export async function getHistory(userId, limit = HISTORY_LIMIT) {
  const rows = await prisma.copilotMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, role: true, content: true, recoId: true, recoTopic: true, createdAt: true },
  });
  return rows.reverse();
}

// Consignes durables repérées dans la conversation et encore en attente de réponse du client
export function pendingChatSuggestions(userId) {
  return prisma.remarkSuggestion.findMany({
    where: { userId, key: "chat", status: "proposée" },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, evidence: true },
  });
}

// Enregistre comme suggestions les consignes proposées par le modèle, sauf si elles répètent
// une remarque ou une suggestion déjà connue (acceptée ou refusée), ou si trop d'autres
// suggestions attendent déjà une réponse. Renvoie les suggestions créées.
export async function proposeFromChat(userId, texts) {
  if (!texts?.length) return [];
  const [pending, remarks, past] = await Promise.all([
    prisma.remarkSuggestion.count({ where: { userId, status: "proposée" } }),
    getRemarks(userId),
    prisma.remarkSuggestion.findMany({ where: { userId }, select: { text: true } }),
  ]);
  let room = MAX_PENDING - pending;
  if (room <= 0) return [];
  const known = [...remarks.map((r) => r.text), ...past.map((s) => s.text)];
  const created = [];
  for (const text of texts) {
    if (room <= 0) break;
    if (known.some((k) => k.toLowerCase() === text.toLowerCase())) continue;
    // Une reformulation d'une habitude déjà connue n'est pas une nouvelle consigne (null = embeddings indisponibles)
    const similarity = await maxSemanticSimilarity(text, known);
    if (similarity !== null && similarity >= SAME_HABIT_SIMILARITY) continue;
    created.push(
      await prisma.remarkSuggestion.create({
        data: { userId, text: text.slice(0, 300), key: "chat", evidence: "Vous l'avez demandé dans la discussion avec le copilote." },
        select: { id: true, text: true, evidence: true },
      })
    );
    known.push(text);
    room--;
  }
  return created;
}
