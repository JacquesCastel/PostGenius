import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { checkPostQuota } from "@/lib/gating";

// Brouillons de l'utilisateur connecté

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const drafts = await prisma.draft.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    drafts: drafts.map((d) => ({ ...d, extra: d.extra ? JSON.parse(d.extra) : null })),
  });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { type, theme, expertise, tone, maxChars, text, extra, inspirationUrl, imageUrl, imagePrompt } =
    await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Texte requis." }, { status: 400 });

  const quota = await checkPostQuota(userId);
  if (!quota.ok) return NextResponse.json({ error: quota.error }, { status: 403 });

  const draft = await prisma.draft.create({
    data: {
      userId,
      type: type ?? "simple",
      theme: theme ?? "",
      expertise: expertise ?? "",
      tone: tone ?? "",
      maxChars: maxChars ?? 3000,
      text,
      extra: extra ? JSON.stringify(extra) : null,
      inspirationUrl: inspirationUrl || null,
      imageUrl: imageUrl || null,
      imagePrompt: imagePrompt || null,
    },
  });
  return NextResponse.json({ draft: { ...draft, extra: extra ?? null } });
}
