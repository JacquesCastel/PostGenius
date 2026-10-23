import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { scoreLeads } from "@/lib/leads";

export const maxDuration = 60;

// Qualification par l'IA des leads pas encore notés (15 au plus par demande), ou de ceux dont on envoie les identifiants.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Qualification indisponible : clé IA manquante sur le serveur." }, { status: 500 });
  if (!rateLimit(`leads-score:${userId}`, { limit: 20, windowMs: 3600_000 })) return NextResponse.json({ error: "Trop de qualifications pour l'instant. Réessayez dans une heure." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string").slice(0, 15) : undefined;
  try {
    const contextId = typeof body.contextId === "string" && body.contextId !== "main" ? body.contextId : null;
    return NextResponse.json(await scoreLeads(userId, { ids, contextId }));
  } catch (e) {
    return NextResponse.json({ error: e.message || "Qualification impossible." }, { status: e.status || 502 });
  }
}
