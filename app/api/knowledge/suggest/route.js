import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { suggestSources } from "@/lib/knowledge";
import { getContextFor } from "@/lib/contexts";

// Sources du datalake les plus proches d'un sujet : l'auteur peut les garder ou en choisir d'autres pour ce texte.
// GET ?topic=…&contextId=… → { suggested: [id], sources: [{ id, title, kind, summary, pinned }] }
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const url = new URL(req.url);
  const topic = String(url.searchParams.get("topic") ?? "").slice(0, 800);
  const rawCtx = url.searchParams.get("contextId");
  let contextId = null;
  if (rawCtx && rawCtx !== "main") {
    const ctx = await getContextFor(userId, rawCtx);
    if (!ctx) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
    contextId = ctx.id;
  }
  try {
    return NextResponse.json(await suggestSources(userId, topic, contextId));
  } catch (e) {
    return NextResponse.json({ error: "Sélection impossible." }, { status: 500 });
  }
}
