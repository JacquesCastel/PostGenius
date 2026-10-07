import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { isLanguage } from "@/lib/languages";
import { serializeExamples, cleanPost, MAX_POSTS } from "@/lib/postImport";
import { MIN_CORPUS_CHARS } from "@/lib/styleCorpus";

// Applique la proposition d'analyse validée par l'utilisateur (POST) ou supprime les exemples
// conservés (DELETE). On ne garde ni l'historique ni le fichier : seulement le portrait ajouté aux
// consignes de style, les thèmes, la langue éventuelle, 3 posts types et, si l'utilisateur le souhaite,
// ses posts (50 au plus) comme corpus d'exemples.

const STYLE_NOTES_MAX = 3000;
const THEMES_MAX = 15;

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { styleNotes: true, themes: true } });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const data = { styleImportedAt: new Date() };

  // Le portrait s'AJOUTE aux consignes existantes : on n'écrase jamais ce que l'utilisateur a écrit
  const added = typeof body.styleNotes === "string" ? body.styleNotes.replace(/\r\n?/g, "\n").trim() : "";
  if (added) {
    const current = user.styleNotes?.trim();
    data.styleNotes = (current ? `${current}\n\n${added}` : added).slice(0, STYLE_NOTES_MAX);
  }
  if (Array.isArray(body.themes)) {
    const list = (user.themes ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    const seen = new Set(list.map((t) => t.toLowerCase()));
    for (const t of body.themes.map((x) => String(x).replace(/[,\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40))) {
      if (t && !seen.has(t.toLowerCase()) && list.length < THEMES_MAX) { list.push(t); seen.add(t.toLowerCase()); }
    }
    data.themes = list.join(", ") || null;
  }
  if (body.postLanguage != null) {
    if (!isLanguage(body.postLanguage)) return NextResponse.json({ error: "Langue non prise en charge." }, { status: 400 });
    data.postLanguage = body.postLanguage;
  }
  data.styleExamples = serializeExamples(body.examples);

  // Corpus : l'utilisateur peut garder tous ses posts (50 au plus) pour que l'IA retrouve ceux qui touchent au sujet.
  // Le nouvel import REMPLACE l'ancien corpus.
  const corpus = body.keepPosts === true && Array.isArray(body.posts)
    ? body.posts.map(cleanPost).filter((t) => t.length >= MIN_CORPUS_CHARS).slice(0, MAX_POSTS)
    : null;

  const [profile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data,
      select: { styleNotes: true, themes: true, postLanguage: true, styleImportedAt: true },
    }),
    ...(corpus
      ? [
          prisma.stylePost.deleteMany({ where: { userId } }),
          prisma.stylePost.createMany({ data: corpus.map((text) => ({ userId, text })) }),
        ]
      : []),
  ]);
  return NextResponse.json({ profile, kept: corpus?.length ?? 0 });
}

export async function DELETE(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { styleExamples: null, styleImportedAt: null } }),
    prisma.stylePost.deleteMany({ where: { userId } }),
  ]);
  return NextResponse.json({ ok: true });
}
