import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getRemarks } from "@/lib/remarks";
import { elementsFor } from "@/lib/languageStore";
import { languageBlock } from "@/lib/languageElements";
import { knowledgeFor } from "@/lib/knowledge";
import { numberBase } from "@/lib/figureCheck";
import { getContextFor } from "@/lib/contexts";
import { getMomentFor, momentBlock } from "@/lib/moments";
import { overlayProfile } from "@/lib/contextOverlay";
import { rateLimit } from "@/lib/ratelimit";

// Base de nombres d'une SÉRIE de posts, pour le contrôle « Chiffres à vérifier » (lib/figureCheck.js).
// La route de génération la renvoie pour un post seul ou des variantes, pas pour une série ; elle est figée par l'empreinte de la démonstration
// éditoriale, donc non modifiée : ce point d'entrée recalcule la même base, avec les mêmes appels et dans le même ordre (série : ni source libre,
// ni inspiration, ni retouche). Lecture seule, aucun appel à l'IA de rédaction. Corps : celui de la génération de la série.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!rateLimit(`figures:${userId}`, { limit: 60, windowMs: 3600_000 })) return NextResponse.json({ error: "Trop de demandes pour le moment." }, { status: 429 });
  let params = {};
  try { params = await req.json(); } catch {}

  const theme = (typeof params.theme === "string" ? params.theme.trim() : "").slice(0, 1500);
  const expertise = typeof params.expertise === "string" ? params.expertise : "";
  if (!theme || !expertise.trim()) return NextResponse.json({ error: "Thématique et expertise requises." }, { status: 400 });

  let profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      headline: true, styleNotes: true, companyName: true, brandVoice: true, editorialLine: true, businessDescription: true,
      targetAudience: true, market: true, commGoals: true, postLanguage: true,
    },
  });
  let ctx = null;
  let moment = null;
  if (params.momentId) {
    moment = await getMomentFor(userId, params.momentId);
    if (moment) params.contextId = moment.contextId;
  }
  if (params.contextId) {
    ctx = await getContextFor(userId, params.contextId);
    if (!ctx) return NextResponse.json({ error: "Thématique introuvable." }, { status: 400 });
    profile = overlayProfile(profile, ctx);
  }
  const remarks = await getRemarks(userId);
  // Mêmes informations que la génération : sources les plus proches du sujet, temps fort, éléments de langage validés
  const knowledge = await knowledgeFor(userId, theme, ctx?.id ?? null, { sourceIds: Array.isArray(params.sourceIds) ? params.sourceIds : null, momentId: moment?.id ?? null });
  knowledge.block += momentBlock(moment);
  knowledge.block += languageBlock(await elementsFor(userId, ctx?.id ?? null));
  const figureKnowledge = knowledge.block;
  const figureBase = numberBase([
    theme, expertise,
    JSON.stringify(params.postContext ?? {}), JSON.stringify(profile ?? {}), JSON.stringify(remarks ?? []), figureKnowledge,
  ]);
  return NextResponse.json({ figureBase });
}
