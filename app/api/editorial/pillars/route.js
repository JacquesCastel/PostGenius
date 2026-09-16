import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getPillars, findOrCreatePillar, reorderPillars } from "@/lib/editorial/pillars";

// Piliers éditoriaux du client (semés avec des valeurs par défaut au premier appel).

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const pillars = await getPillars(userId);
  return NextResponse.json({ pillars });
}

// Ajoute un pilier personnalisé (les piliers par défaut restent modifiables
// via ce même mécanisme : un nom identique, insensible à la casse, est réutilisé).
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis." }, { status: 400 });

  const pillar = await findOrCreatePillar(userId, name.trim().slice(0, 60));
  return NextResponse.json({ pillar });
}

// Réordonne les piliers par importance (Copilote IA — flèches haut/bas).
export async function PUT(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { order } = await req.json();
  if (!Array.isArray(order) || !order.length) {
    return NextResponse.json({ error: "Ordre requis." }, { status: 400 });
  }

  const pillars = await reorderPillars(userId, order);
  return NextResponse.json({ pillars });
}
