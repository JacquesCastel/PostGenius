import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { reanalyzeKnowledgeSource, KnowledgeError } from "@/lib/knowledge";

// Relecture éditoriale d'une source déjà enregistrée : thèmes, vocabulaire, positions.
export async function POST(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ source: await reanalyzeKnowledgeSource(userId, id) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e instanceof KnowledgeError ? e.status : 500 });
  }
}
