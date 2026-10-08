import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getContextFor } from "@/lib/contexts";
import { listLanguage, proposeLanguage } from "@/lib/languageStore";
import { KnowledgeError } from "@/lib/knowledge";

// Éléments de langage d'une entreprise : validés + propositions en attente (GET), nouvelles propositions de l'IA (POST).
async function scope(userId, raw) {
  const id = raw && raw !== "main" ? String(raw) : null;
  if (!id) return null;
  const ctx = await getContextFor(userId, id);
  if (!ctx) throw new KnowledgeError("Entreprise introuvable.", 404);
  return ctx.id;
}
const fail = (e) => NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e instanceof KnowledgeError ? e.status : 500 });

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  try {
    return NextResponse.json(await listLanguage(userId, await scope(userId, new URL(req.url).searchParams.get("contextId"))));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await proposeLanguage(userId, await scope(userId, body.contextId)));
  } catch (e) {
    return fail(e);
  }
}
