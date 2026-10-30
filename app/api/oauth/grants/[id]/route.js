import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { revokeGrant } from "@/lib/oauth";

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  return (await revokeGrant(userId, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Introuvable." }, { status: 404 });
}
