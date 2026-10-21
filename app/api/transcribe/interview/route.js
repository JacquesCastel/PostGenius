import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { prisma } from "@/lib/db";
import { interviewQuestions, FALLBACK_QUESTIONS } from "@/lib/voice";

export const maxDuration = 60;

// Interview guidée : { topic? } → { questions: [3 questions] }. Sans clé IA ou en cas d'échec, trois questions génériques.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!rateLimit(`transcribe-interview:${userId}`, { limit: 20, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop d'interviews pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }
  const { topic } = await req.json().catch(() => ({}));
  const t = typeof topic === "string" ? topic.trim().slice(0, 500) : "";
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ questions: FALLBACK_QUESTIONS, fallback: true });
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { expertise: true, targetAudience: true, postLanguage: true } });
  return NextResponse.json(await interviewQuestions(userId, { topic: t, expertise: u?.expertise ?? "", audience: u?.targetAudience ?? "", language: u?.postLanguage ?? "" }));
}
