import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess, checkVoiceQuota, limitBody } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { logUsage } from "@/lib/usage";
import { prisma } from "@/lib/db";
import { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, MAX_SECONDS, audioExtension, billedSeconds, transcribe } from "@/lib/voice";

export const maxDuration = 60;

// Dictée vocale : transcrit un enregistrement (champ « file », multipart) en texte. Rien n'est conservé : l'audio reste en mémoire.
// GET : minutes utilisées et restantes ce mois-ci.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const q = await checkVoiceQuota(userId);
  return NextResponse.json({ usedSeconds: q.usedSeconds ?? 0, limitSeconds: q.limitSeconds ?? null, maxSeconds: MAX_SECONDS });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!rateLimit(`transcribe:${userId}`, { limit: 30, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop d'enregistrements pour l'instant. Réessayez dans une heure, ou écrivez votre texte." }, { status: 429 });
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_AUDIO_BYTES + 200_000) return NextResponse.json({ error: "Enregistrement trop volumineux (8 Mo au maximum)." }, { status: 413 });

  const quota = await checkVoiceQuota(userId);
  if (!quota.ok) return NextResponse.json(limitBody(quota), { status: 403 });

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envoi de l'enregistrement illisible." }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Aucun enregistrement reçu." }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Enregistrement trop volumineux (8 Mo au maximum)." }, { status: 413 });
  if (file.size < MIN_AUDIO_BYTES) return NextResponse.json({ error: "Enregistrement trop court : parlez au moins quelques secondes." }, { status: 400 });
  if (!audioExtension(file.type)) return NextResponse.json({ error: "Format audio non pris en charge." }, { status: 415 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const seconds = billedSeconds(form.get("seconds"), buffer.length);
  try {
    // Langue : celle demandée, sinon la langue de rédaction du profil
    const asked = form.get("language");
    const language = asked || (await prisma.user.findUnique({ where: { id: userId }, select: { postLanguage: true } }))?.postLanguage;
    const text = await transcribe({ buffer, mime: file.type, language });
    logUsage(userId, { kind: "transcription", context: "dictée vocale", seconds });
    if (!text) return NextResponse.json({ error: "Aucune parole reconnue. Rapprochez-vous du micro et réessayez." }, { status: 422 });
    return NextResponse.json({ text, seconds });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Transcription impossible." }, { status: e.status || 502 });
  }
}
