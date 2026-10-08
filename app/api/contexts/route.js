import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { cleanContextInput, MAX_CONTEXTS } from "@/lib/contexts";

// Entreprises supplémentaires de l'utilisateur (l'entreprise principale reste dans son profil).

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const contexts = await prisma.context.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ contexts, max: MAX_CONTEXTS });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data = cleanContextInput(body);
  if (!data.name) return NextResponse.json({ error: "Le nom de l'entreprise est requis." }, { status: 400 });
  if ((await prisma.context.count({ where: { userId } })) >= MAX_CONTEXTS) {
    return NextResponse.json({ error: `Vous pouvez gérer ${MAX_CONTEXTS} entreprises supplémentaires au plus.` }, { status: 400 });
  }
  const context = await prisma.context.create({ data: { userId, ...data } });
  return NextResponse.json({ context });
}
