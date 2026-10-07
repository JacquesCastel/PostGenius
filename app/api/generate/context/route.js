import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { generationContext } from "@/lib/generationContext";

// Contexte que le copilote utilisera pour le sujet saisi (lecture seule, aucun appel IA).
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const topic = [body.theme, body.sourceTitle].filter((v) => typeof v === "string").join(" ").slice(0, 2000);
  try {
    return NextResponse.json(await generationContext(userId, topic));
  } catch (e) {
    console.error("[contexte] lecture impossible :", e.message);
    return NextResponse.json({ error: "Contexte indisponible." }, { status: 500 });
  }
}
