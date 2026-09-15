import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getLinkedInWatch } from "@/lib/editorial/linkedinWatch";

// Bloc "Veille LinkedIn" de la page Copilote IA — actualité et bonnes
// pratiques de publication sur LinkedIn, agrégée depuis des sources
// spécialisées. Contenu global, identique pour tous les comptes.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("refresh") === "1";

  const items = await getLinkedInWatch({ force });
  return NextResponse.json({ items });
}
