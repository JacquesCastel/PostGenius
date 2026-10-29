import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { checkFeature, limitBody } from "@/lib/gating";
import { createApiKey, listApiKeys, KeyError } from "@/lib/apiKeys";

// Clés personnelles pour brancher un assistant (MCP) : liste et création. Réservé aux offres Pro et Agence.
// Pas d'usage « en tant que » un client : une clé appartient à la personne connectée elle-même.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  return NextResponse.json({ keys: await listApiKeys(userId) });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const feat = await checkFeature(userId, "campaigns", "L'accès par assistant (MCP)");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await createApiKey(userId, { name: body.name, write: body.write === true }));
  } catch (e) {
    if (e instanceof KeyError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
