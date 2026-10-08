import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { respondToProposal } from "@/lib/languageStore";
import { KnowledgeError } from "@/lib/knowledge";

// Accepter (texte éventuellement modifié) ou ignorer une proposition d'élément de langage.
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await respondToProposal(userId, id, { action: body.action, text: body.text }));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e instanceof KnowledgeError ? e.status : 500 });
  }
}
