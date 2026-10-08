import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { cleanContextInput } from "@/lib/contexts";

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data = cleanContextInput(body);
  if (data.name === "") return NextResponse.json({ error: "Le nom de l'entreprise est requis." }, { status: 400 });
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
  const { count } = await prisma.context.updateMany({ where: { id, userId }, data });
  if (count === 0) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
  return NextResponse.json({ context: await prisma.context.findUnique({ where: { id } }) });
}

// Supprime l'entreprise et les sources de sa base de connaissances ; ses posts restent (sans entreprise rattachée)
export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const { count } = await prisma.context.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
