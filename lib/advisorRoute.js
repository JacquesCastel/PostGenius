import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { getContextFor } from "@/lib/contexts";
import { overlayProfile } from "@/lib/contextOverlay";
import { knowledgeFor } from "@/lib/knowledge";
import { cleanSource } from "@/lib/generationSource";
import { advisorEnabled } from "@/lib/advisorFlag";

// Préambule commun des routes du conseiller éditorial : interrupteur de développement, authentification, accès, limite de consommation, taille de la requête.
// Renvoie { userId } ou { response }.
export async function advisorPreflight(req, { bucket, limit, windowMs = 3600_000, maxBytes = 40_000 }) {
  if (!advisorEnabled()) return { response: NextResponse.json({ error: "Non disponible." }, { status: 404 }) };
  const userId = await getEffectiveUserId(req);
  if (!userId) return { response: NextResponse.json({ error: "Non connecté." }, { status: 401 }) };
  const access = await checkAccess(userId);
  if (!access.ok) return { response: NextResponse.json({ error: access.error, code: access.code }, { status: 403 }) };
  if (!rateLimit(`advisor-${bucket}:${userId}`, { limit, windowMs })) return { response: NextResponse.json({ error: "Trop de demandes pour le moment. Réessayez dans quelques minutes.", code: "rate_limited" }, { status: 429 }) };
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) return { response: NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 }) };
  return { userId };
}

export async function readBody(req) {
  try { const b = await req.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; }
}

// Profil de marque et sources de CE compte uniquement (aucune donnée d'un autre compte ni d'une autre marque n'est lue).
export async function authorContext(userId, { contextId, sourceIds, source, topic }) {
  let profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { headline: true, companyName: true, businessDescription: true, targetAudience: true, market: true, commGoals: true, editorialLine: true, styleNotes: true },
  });
  let ctx = null;
  if (contextId) {
    ctx = await getContextFor(userId, String(contextId));
    if (!ctx) return { error: "Thématique introuvable." };
    profile = overlayProfile(profile, ctx);
  }
  const parts = [];
  try {
    const k = await knowledgeFor(userId, topic, ctx?.id ?? null, { sourceIds: Array.isArray(sourceIds) ? sourceIds : null });
    if (k?.block) parts.push(k.block.slice(0, 6000));
  } catch {}
  const src = cleanSource(source);
  if (src) parts.push(`Source fournie${src.title ? ` — ${src.title}` : ""} :\n${src.text.slice(0, 4000)}`);
  return { profile, sourcesBlock: parts.join("\n\n") };
}
