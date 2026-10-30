import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { listGrants } from "@/lib/oauth";

// Assistants connectés par OAuth au compte de la personne connectée (Mon profil)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  return NextResponse.json({ grants: await listGrants(userId) });
}
