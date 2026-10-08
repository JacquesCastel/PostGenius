import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { createKnowledgeSource, guardKnowledgeAdd, fetchPageText, KnowledgeError } from "@/lib/knowledge";
import { cleanText, sourceView } from "@/lib/knowledgeText";
import { knowledgeLimit, planOf, upgradeTarget } from "@/lib/plans";
import { resolveSourceScope } from "@/lib/contexts";

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
      select: { id: true, kind: true, title: true, origin: true, summary: true, facts: true, insights: true, pinned: true, charCount: true, createdAt: true, contextId: true, shared: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ]);
  return NextResponse.json({ sources: sources.map(sourceView), limit: knowledgeLimit(user), plan: planOf(user).name, upgradeTo: upgradeTarget(planOf(user).id, "knowledge") });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let kind, title, origin = null, text;
  try {
    const quota = await guardKnowledgeAdd(userId);
    const scope = await resolveSourceScope(userId, body);
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
    return NextResponse.json(await createKnowledgeSource(userId, { kind, origin, title, text, ...scope }, quota));
  } catch (e) {
    const status = e instanceof KnowledgeError ? e.status : 400;
    return NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.extra ?? {}) }, { status });
  }
}
