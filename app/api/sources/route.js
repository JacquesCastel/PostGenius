import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { resolveSource } from "@/lib/veille";
import { checkFeature } from "@/lib/gating";

// Sources de veille du client

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const sources = await prisma.contentSource.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ sources });
}

// Ajout manuel : accepte une URL de flux RSS ou de site (flux découvert automatiquement)
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const feat = await checkFeature(userId, "veille", "La veille connectée");
  if (!feat.ok) return NextResponse.json({ error: feat.error }, { status: 403 });

  const { url, title } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL requise." }, { status: 400 });

  try {
    const { feedUrl } = await resolveSource(url.trim());
    const name = title?.trim() || new URL(feedUrl).hostname.replace(/^www\./, "");
    const source = await prisma.contentSource.upsert({
      where: { userId_url: { userId, url: feedUrl } },
      update: {},
      create: { userId, url: feedUrl, title: name },
    });
    return NextResponse.json({ source });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Source invalide." }, { status: 400 });
  }
}

export async function DELETE(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await prisma.contentSource.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
