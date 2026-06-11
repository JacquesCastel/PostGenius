import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// PATCH : modifier texte/statut — DELETE : supprimer
// La clause where inclut toujours userId : un client ne touche que SES brouillons.

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const { text, status, postId, scheduledAt, target } = await req.json();

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
      ...(status === "brouillon" && { publishError: null }),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Brouillon introuvable." }, { status: 404 });
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
