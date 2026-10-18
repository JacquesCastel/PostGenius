import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getEngine } from "@/lib/datalakeEngine";
import { KnowledgeError } from "@/lib/knowledge";

// Ce que le moteur a appris des sources de l'entreprise : synthèse en cache, et si elle est à actualiser.
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  try {
    return NextResponse.json(await getEngine(userId, new URL(req.url).searchParams.get("contextId")));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e instanceof KnowledgeError ? e.status : 500 });
  }
}
