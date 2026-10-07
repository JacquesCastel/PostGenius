import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { normalizeMood } from "@/lib/moods";

// Archiver (PATCH) ou supprimer (DELETE) une campagne.
// DELETE ?posts=delete supprime aussi ses posts non publiés ; ?posts=keep (défaut) les garde, détachés de la campagne.
// Un post déjà publié sur LinkedIn n'est jamais supprimé ici : il reste dans « Mes posts ».

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  // Humeur : s'applique aux prochains posts générés (les posts existants ne changent pas)
  const data = {};
  if ("mood" in body) data.mood = normalizeMood(body.mood);
  if ("status" in body) {
    if (!["active", "archivée"].includes(body.status)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
  const { count } = await prisma.campaign.updateMany({ where: { id, userId }, data });
  if (count === 0) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const mode = new URL(req.url).searchParams.get("posts") === "delete" ? "delete" : "keep";

  const campaign = await prisma.campaign.findFirst({ where: { id, userId }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });

  // Les posts restants perdent le lien avec la campagne (clé étrangère SetNull) ; les publiés sont toujours conservés
  let deletedPosts = 0;
  if (mode === "delete") {
    const r = await prisma.draft.deleteMany({ where: { campaignId: id, userId, status: { not: "publié" }, postId: null } });
    deletedPosts = r.count;
  }
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true, deletedPosts });
}
