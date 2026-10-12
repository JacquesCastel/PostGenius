import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getContextFor } from "@/lib/contexts";
import { cleanSnippet, MAX_SNIPPETS } from "@/lib/snippets";

async function scope(userId, raw) {
  if (!raw || raw === "main") return { contextId: null };
  const ctx = await getContextFor(userId, String(raw));
  return ctx ? { contextId: ctx.id } : { error: "Entreprise introuvable." };
}

// GET /api/snippets?contextId= — bibliothèque de l'entreprise (les plus utilisées d'abord)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const sc = await scope(userId, new URL(req.url).searchParams.get("contextId"));
  if (sc.error) return NextResponse.json({ error: sc.error }, { status: 400 });
  const snippets = await prisma.snippet.findMany({ where: { userId, contextId: sc.contextId }, orderBy: [{ uses: "desc" }, { createdAt: "desc" }], take: MAX_SNIPPETS });
  return NextResponse.json({ snippets });
}

// POST { kind, title?, text, contextId? } — enregistre un contenu
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sc = await scope(userId, body.contextId);
  if (sc.error) return NextResponse.json({ error: sc.error }, { status: 400 });
  const data = cleanSnippet(body);
  if (data.text.length < 3) return NextResponse.json({ error: "Rien à enregistrer : le texte est vide." }, { status: 400 });
  if ((await prisma.snippet.count({ where: { userId } })) >= MAX_SNIPPETS) {
    return NextResponse.json({ error: `Bibliothèque pleine (${MAX_SNIPPETS} contenus) : supprimez-en avant d'en ajouter.` }, { status: 400 });
  }
  const dup = await prisma.snippet.findFirst({ where: { userId, contextId: sc.contextId, text: data.text }, select: { id: true } });
  if (dup) return NextResponse.json({ error: "Ce contenu est déjà dans la bibliothèque." }, { status: 409 });
  const snippet = await prisma.snippet.create({ data: { userId, contextId: sc.contextId, ...data } });
  return NextResponse.json({ snippet });
}
