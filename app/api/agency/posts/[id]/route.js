import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// PATCH /api/agency/posts/:id — l'agence relit un post d'un de ses clients
// sans changer de compte : modifier le texte, ou le valider (à valider → programmé).
export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const agency = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!agency || agency.plan !== "agence") {
    return NextResponse.json({ error: "Réservé au plan Agence" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const draft = await prisma.draft.findFirst({
    where: { id, user: { managedByUserId: userId } },
    select: { id: true, status: true, postId: true },
  });
  if (!draft) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
  if (draft.status === "publié" || draft.postId) {
    return NextResponse.json({ error: "Ce post est déjà publié" }, { status: 409 });
  }

  const data = {};
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) return NextResponse.json({ error: "Le texte est vide" }, { status: 400 });
    if (text.length > 3000) return NextResponse.json({ error: "Texte trop long" }, { status: 400 });
    data.text = text;
  }
  if (body.status !== undefined) {
    if (body.status !== "programmé" || draft.status !== "à valider") {
      return NextResponse.json({ error: "Changement de statut non autorisé" }, { status: 400 });
    }
    data.status = "programmé";
    data.publishError = null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

  const updated = await prisma.draft.update({ where: { id }, data, select: { id: true, status: true, text: true } });
  return NextResponse.json({ draft: updated });
}
