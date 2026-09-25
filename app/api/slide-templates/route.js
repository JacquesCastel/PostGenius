import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// GET /api/slide-templates — les modèles personnalisés de l'utilisateur (éditeur
// visuel, Charte graphique), par type de slide.
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const rows = await prisma.slideTemplate.findMany({ where: { userId } });
  const templates = Object.fromEntries(
    rows.map((r) => [r.kind, { elements: JSON.parse(r.data).elements ?? [] }])
  );
  return NextResponse.json({ templates });
}
