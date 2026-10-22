import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { generateBrief, editBrief } from "@/lib/datalakeEngine";
import { KnowledgeError } from "@/lib/knowledge";

const fail = (e) => NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e instanceof KnowledgeError ? e.status : 500 });

// (Re)génère la synthèse de ce que le moteur a appris. La première fois, elle devient la base ; ensuite, l'actualisation
// n'efface rien : ses apports arrivent comme nouveautés à valider.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await generateBrief(userId, body.contextId));
  } catch (e) {
    return fail(e);
  }
}

// Valider, modifier, supprimer ou refuser un élément : { contextId, action: accept | dismiss | edit | delete | acceptAll, field, index?, text? }
export async function PATCH(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await editBrief(userId, body.contextId, { action: body.action, field: body.field, index: body.index, text: body.text }));
  } catch (e) {
    return fail(e);
  }
}
