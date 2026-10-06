import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess, checkKnowledgeQuota } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { analyzeSource, fetchPageText } from "@/lib/knowledge";
import { cleanText, sourceView } from "@/lib/knowledgeText";
import { knowledgeLimit, planOf } from "@/lib/plans";

// Base de connaissances du client : liste (GET) et ajout d'une note ou d'un lien (POST).
// Chaque ajout est analysé par l'IA (titre, résumé, faits vérifiés dans la source).

const MIN_NOTE = 80;

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const [sources, user] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, title: true, origin: true, summary: true, facts: true, pinned: true, charCount: true, createdAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ]);
  return NextResponse.json({ sources: sources.map(sourceView), limit: knowledgeLimit(user), plan: planOf(user).name });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Analyse indisponible : clé IA manquante sur le serveur." }, { status: 500 });

  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  const quota = await checkKnowledgeQuota(userId);
  if (!quota.ok) return NextResponse.json({ error: quota.error, code: "knowledge_limit" }, { status: 403 });
  if (!rateLimit(`knowledge:${userId}`, { limit: 20, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop d'ajouts pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  let kind, title, origin = null, text;
  try {
    if (body.kind === "link") {
      const url = String(body.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Collez l'adresse complète d'une page (https://…)." }, { status: 400 });
      const page = await fetchPageText(url);
      kind = "link"; origin = url; title = String(body.title ?? "").trim() || page.title; text = page.text;
    } else if (body.kind === "note") {
      text = cleanText(body.text);
      if (text.length < MIN_NOTE) return NextResponse.json({ error: `Texte trop court : au moins ${MIN_NOTE} caractères pour que l'IA en tire quelque chose.` }, { status: 400 });
      kind = "note"; title = String(body.title ?? "").trim();
    } else {
      return NextResponse.json({ error: "Type de source inconnu." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  let analysis;
  try {
    analysis = await analyzeSource({ userId, title, origin, text });
  } catch (e) {
    console.error("Erreur analyse de source:", e.message);
    return NextResponse.json({ error: "L'analyse a échoué. Réessayez dans un instant." }, { status: 502 });
  }

  const source = await prisma.knowledgeSource.create({
    data: {
      userId, kind, origin, text,
      title: (String(body.title ?? "").trim() || analysis.title).slice(0, 120),
      summary: analysis.summary,
      facts: JSON.stringify(analysis.facts),
      charCount: text.length,
    },
  });
  return NextResponse.json({ source: sourceView(source), used: quota.used + 1, limit: quota.limit });
}
