import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getContextFor } from "@/lib/contexts";
import { postsOverview } from "@/lib/datalakePosts";

// Posts de l'auteur présents dans le datalake (publiés pour l'entreprise + importés).
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("contextId");
  let contextId = null;
  if (raw && raw !== "main") {
    const ctx = await getContextFor(userId, raw);
    if (!ctx) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
    contextId = ctx.id;
  }
  return NextResponse.json(await postsOverview(userId, contextId));
}
