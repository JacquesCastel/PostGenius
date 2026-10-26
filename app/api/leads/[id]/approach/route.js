import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { approachLead } from "@/lib/leads";

export const maxDuration = 60;

// Prépare l'approche d'un lead (signal d'achat, problème fréquent, premier message). Rien n'est envoyé ni enregistré.
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Rédaction indisponible : clé IA manquante sur le serveur." }, { status: 500 });
  if (!rateLimit(`leads-approach:${userId}`, { limit: 30, windowMs: 3600_000 })) return NextResponse.json({ error: "Trop de messages préparés pour l'instant. Réessayez dans une heure." }, { status: 429 });
  const { id } = await params;
  try {
    return NextResponse.json(await approachLead(userId, id));
  } catch (e) {
    return NextResponse.json({ error: e.message || "Préparation impossible." }, { status: e.status || 502 });
  }
}
