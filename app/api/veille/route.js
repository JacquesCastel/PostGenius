import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { getVeille } from "@/lib/veille";
import { checkFeature } from "@/lib/gating";

// Articles récents agrégés depuis les sources du client (cache 30 min)

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const feat = await checkFeature(userId, "veille", "La veille connectée");
  if (!feat.ok) return NextResponse.json({ error: feat.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("refresh") === "1";

  const sources = await prisma.contentSource.findMany({ where: { userId } });
  if (!sources.length) return NextResponse.json({ items: [] });

  const items = await getVeille(userId, sources, { force });
  return NextResponse.json({ items });
}
