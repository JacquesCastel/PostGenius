import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { cleanTranscript, MAX_TEXT_CHARS } from "@/lib/voice";

export const maxDuration = 60;

// Nettoyage facultatif d'une dictée relue : { text } → { text, changed }. N'ajoute rien (voir lib/voice.js).
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Nettoyage indisponible : clé IA manquante sur le serveur." }, { status: 500 });
  if (!rateLimit(`transcribe-clean:${userId}`, { limit: 30, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop de nettoyages pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }
  const { text } = await req.json().catch(() => ({}));
  const t = typeof text === "string" ? text.trim() : "";
  if (t.length < 20) return NextResponse.json({ error: "Texte trop court pour être nettoyé." }, { status: 400 });
  if (t.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "Texte trop long." }, { status: 413 });
  try {
    return NextResponse.json(await cleanTranscript(userId, t));
  } catch (e) {
    return NextResponse.json({ error: e.message || "Nettoyage impossible." }, { status: e.status || 502 });
  }
}
