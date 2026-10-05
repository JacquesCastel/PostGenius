import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { normalizeMood } from "@/lib/moods";

// Archiver / supprimer une campagne (les posts existants sont conservés)

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
