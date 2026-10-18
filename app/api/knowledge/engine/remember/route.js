import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { rememberFromEngine } from "@/lib/datalakeEngine";
import { KnowledgeError } from "@/lib/knowledge";

// L'auteur accepte de faire retenir une proposition du moteur (précision, mot à privilégier ou à éviter, formulation type).
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await rememberFromEngine(userId, body.contextId, { kind: body.kind, text: body.text }));
  } catch (e) {
    return NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.extra ?? {}) }, { status: e instanceof KnowledgeError ? e.status : 500 });
  }
}
