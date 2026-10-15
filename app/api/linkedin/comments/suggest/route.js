import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { logUsage } from "@/lib/usage";
import { rateLimit } from "@/lib/ratelimit";
import { getRemarks } from "@/lib/remarks";
import { buildReplyPrompt, cleanReplies } from "@/lib/commentReply";

// POST { draftId, commentText } → { replies: [3 variantes] }. Rien n'est envoyé à LinkedIn ici. Le nom du commentateur n'est jamais transmis à l'IA.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Clé IA manquante." }, { status: 500 });
  if (!rateLimit(`reply-suggest:${userId}`, { limit: 30, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop de suggestions sur la dernière heure. Réessayez plus tard." }, { status: 429 });
  }

  const { draftId, commentText } = await req.json().catch(() => ({}));
  if (!draftId || !String(commentText ?? "").trim()) return NextResponse.json({ error: "Post et commentaire requis." }, { status: 400 });
  const draft = await prisma.draft.findFirst({ where: { id: String(draftId), userId }, select: { text: true, target: true } });
  if (!draft) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

  const [profile, remarks, acc] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { headline: true, tone: true, styleNotes: true } }),
    getRemarks(userId).catch(() => []),
    prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgName: true } }),
  ]);
  const prompt = buildReplyPrompt({ postText: draft.text, commentText, target: draft.target, profile, pageName: acc?.orgName, remarks });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_CHAT_MODEL || "claude-haiku-4-5-20251001", max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error("api " + res.status);
    const data = await res.json();
    logUsage(userId, { kind: "claude", context: "réponse commentaire", inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 });
    const match = (data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
    const replies = cleanReplies(match ? JSON.parse(match[0]) : null);
    if (!replies.length) throw new Error("réponse vide");
    return NextResponse.json({ replies });
  } catch (e) {
    console.error("Erreur suggestion de réponse:", e.message);
    return NextResponse.json({ error: "La suggestion a échoué. Réessayez." }, { status: 502 });
  }
}
