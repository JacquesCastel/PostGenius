import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { revokeApiKey } from "@/lib/apiKeys";

// Révocation immédiate d'une clé personnelle.
export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  if (!(await revokeApiKey(userId, id))) return NextResponse.json({ error: "Clé introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
