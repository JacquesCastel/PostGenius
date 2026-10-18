import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { chatWithEngine } from "@/lib/datalakeEngine";
import { KnowledgeError } from "@/lib/knowledge";

// Un tour d'échange avec le moteur : sa réponse et ce qu'il propose de retenir (rien n'est enregistré ici).
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await chatWithEngine(userId, body.contextId, { message: body.message, history: body.history }));
  } catch (e) {
    return NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e instanceof KnowledgeError ? e.status : 500 });
  }
}
