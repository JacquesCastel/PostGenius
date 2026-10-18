import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { generateBrief } from "@/lib/datalakeEngine";
import { KnowledgeError } from "@/lib/knowledge";

// (Re)génère la synthèse de ce que le moteur a appris.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await generateBrief(userId, body.contextId));
  } catch (e) {
    return NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e instanceof KnowledgeError ? e.status : 500 });
  }
}
