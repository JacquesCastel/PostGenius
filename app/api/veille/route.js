import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getVeille } from "@/lib/veille";
import { checkFeature, limitBody } from "@/lib/gating";
import { getContextFor } from "@/lib/contexts";

// Articles récents agrégés depuis les sources du client (cache 30 min)

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const feat = await checkFeature(userId, "veille", "La veille connectée");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("refresh") === "1";

  const contextId = searchParams.get("contextId") || null;
  if (contextId && !(await getContextFor(userId, contextId))) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 400 });
  const sources = await prisma.contentSource.findMany({ where: { userId, contextId } });
  if (!sources.length) return NextResponse.json({ items: [] });

  const items = await getVeille(userId, sources, { force, scope: contextId ?? "" });
  return NextResponse.json({ items });
}
