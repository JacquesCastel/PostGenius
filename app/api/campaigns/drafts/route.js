import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, limitBody } from "@/lib/gating";
import { getContextFor } from "@/lib/contexts";
import { packDraft, MAX_DRAFTS } from "@/lib/campaignDraft";

// Brouillons de campagne : la création en cours (assistant ou relecture d'un brief importé) est enregistrée au fil de l'eau,
// pour la reprendre plus tard sans tout refaire. Un brouillon est une campagne au statut « brouillon » : invisible des listes
// actives, jamais planifiée, supprimable.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const feat = await checkFeature(userId, "campaigns", "L'outil de campagne");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  const body = await req.json().catch(() => ({}));
  let packed;
  try {
    packed = packDraft(body);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  if ((await prisma.campaign.count({ where: { userId, status: "brouillon" } })) >= MAX_DRAFTS) {
    return NextResponse.json({ error: `Vous avez déjà ${MAX_DRAFTS} brouillons : supprimez-en avant d'en enregistrer un nouveau.` }, { status: 400 });
  }
  let contextId = null;
  if (body.contextId) {
    const own = await getContextFor(userId, body.contextId);
    if (own) contextId = own.id;
  }
  const draft = await prisma.campaign.create({ data: { userId, name: packed.name, theme: String(body.theme ?? "").slice(0, 200), status: "brouillon", draftState: packed.json, contextId } });
  return NextResponse.json({ id: draft.id, updatedAt: draft.updatedAt });
}
