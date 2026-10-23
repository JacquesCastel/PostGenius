import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { cleanMomentInput, momentState } from "@/lib/moments";

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data, bad } = cleanMomentInput(body);
  if (data.name === "") return NextResponse.json({ error: "Le nom du temps fort est requis." }, { status: 400 });
  const current = await prisma.moment.findFirst({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: "Temps fort introuvable." }, { status: 404 });
  const startsAt = "startsAt" in data ? data.startsAt : current.startsAt;
  const endsAt = "endsAt" in data ? data.endsAt : current.endsAt;
  if (bad.some((k) => k !== "endsAt") || (startsAt && endsAt && endsAt < startsAt)) return NextResponse.json({ error: "Dates invalides : la fin doit être après le début." }, { status: 400 });
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
  const moment = await prisma.moment.update({ where: { id }, data });
  return NextResponse.json({ moment: { ...moment, state: momentState(moment) } });
}

// Supprime le temps fort ; ses sources et ses posts restent (les sources rejoignent le datalake de la thématique)
export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const { count } = await prisma.moment.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Temps fort introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
