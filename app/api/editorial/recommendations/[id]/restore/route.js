import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { sanitizeRecoPatch } from "@/lib/editorial/chat";

// Rétablit la version précédente d'une piste retravaillée dans la discussion (bouton « Annuler »).
// Le corps contient les champs d'origine ; la piste doit encore être en attente. Un message est
// ajouté à l'historique pour que le copilote sache que la modification a été annulée.

export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const { fields } = await req.json().catch(() => ({}));

  const reco = await prisma.editorialRecommendation.findFirst({ where: { id, userId, status: "proposée" } });
  if (!reco) return NextResponse.json({ error: "Cette piste n'est plus disponible." }, { status: 409 });
  const patch = sanitizeRecoPatch(fields, reco, { allowEmpty: true });
  if (!patch) return NextResponse.json({ error: "Rien à rétablir." }, { status: 400 });

  const [updated] = await prisma.$transaction([
    prisma.editorialRecommendation.update({ where: { id }, data: patch, include: { pillar: { select: { id: true, name: true } } } }),
    prisma.copilotMessage.create({ data: { userId, role: "assistant", content: "↩ Version précédente de la piste rétablie.", recoId: id, recoTopic: reco.topic.slice(0, 160) } }),
  ]);
  return NextResponse.json({ reco: updated });
}
