import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { computeFunnel } from "@/lib/funnel";

// Entonnoir produit (admin) : ?days=30 (7, 30, 90) ou 0 pour tout l'historique

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const raw = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const days = [0, 7, 30, 90].includes(raw) ? raw : 30;

  const steps = await computeFunnel(prisma, days);
  return NextResponse.json({ days, steps });
}
