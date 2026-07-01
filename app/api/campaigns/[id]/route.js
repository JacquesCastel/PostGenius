import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// Archiver / supprimer une campagne (les posts existants sont conservés)

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();
  if (!["active", "archivée"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }
  const { count } = await prisma.campaign.updateMany({ where: { id, userId }, data: { status } });
  if (count === 0) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
