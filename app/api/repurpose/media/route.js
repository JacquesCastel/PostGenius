import { NextResponse } from "next/server";
import { mediaUser, mediaFail } from "@/lib/mediaHttp";
import { createJob, MAX_BYTES, MAX_SECONDS, CHUNK_BYTES } from "@/lib/mediaJobs";
import { checkMediaQuota } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { prisma } from "@/lib/db";

// Vidéo ou audio pour « Seconde vie d'un contenu ».
// GET : limites et minutes restantes ce mois-ci. POST { name, size, language? } : ouvre un envoi (le fichier suit, par morceaux).

export async function GET(req) {
  const g = await mediaUser(req);
  if (g.res) return g.res;
  const q = await checkMediaQuota(g.userId, 0);
  const u = await prisma.user.findUnique({ where: { id: g.userId }, select: { postLanguage: true } });
  return NextResponse.json({ maxMb: Math.round(MAX_BYTES / 1048576), maxMinutes: Math.round(MAX_SECONDS / 60), chunkBytes: CHUNK_BYTES, usedSeconds: q.usedSeconds ?? 0, limitSeconds: q.limitSeconds ?? null, language: u?.postLanguage ?? "fr" });
}

export async function POST(req) {
  const g = await mediaUser(req);
  if (g.res) return g.res;
  if (!rateLimit(`repurpose-media:${g.userId}`, { limit: Number(process.env.MEDIA_UPLOAD_LIMIT) || 10, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop d'envois de vidéo à la suite. Réessayez dans une heure, ou collez la transcription." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await createJob(g.userId, { name: body.name, size: body.size, language: body.language }));
  } catch (e) { return mediaFail(e); }
}
