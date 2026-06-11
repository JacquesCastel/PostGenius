import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// Enregistre le compte LinkedIn connecté via Phyllo Connect
// (accountId renvoyé par le callback "accountConnected" du SDK)

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { accountId } = await req.json();
  if (!accountId?.trim()) return NextResponse.json({ error: "accountId requis." }, { status: 400 });

  await prisma.user.update({ where: { id: userId }, data: { phylloAccountId: accountId.trim() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  await prisma.user.update({ where: { id: userId }, data: { phylloAccountId: null } });
  return NextResponse.json({ ok: true });
}
