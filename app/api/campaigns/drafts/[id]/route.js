import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getContextFor } from "@/lib/contexts";
import { packDraft } from "@/lib/campaignDraft";

// Met à jour l'état d'un brouillon de campagne (enregistrement automatique pendant la création).
export async function PUT(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  let packed;
  try {
    packed = packDraft(body);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  let contextId = null;
  if (body.contextId) {
    const own = await getContextFor(userId, body.contextId);
    if (own) contextId = own.id;
  }
  const { count } = await prisma.campaign.updateMany({ where: { id, userId, status: "brouillon" }, data: { name: packed.name, theme: String(body.theme ?? "").slice(0, 200), draftState: packed.json, contextId } });
  if (count === 0) return NextResponse.json({ error: "Brouillon introuvable (supprimé ou déjà créé)." }, { status: 404 });
  return NextResponse.json({ ok: true, updatedAt: new Date() });
}
