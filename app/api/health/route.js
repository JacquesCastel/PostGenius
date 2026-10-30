import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// État de santé pour la surveillance extérieure (UptimeRobot, etc.) et le contrôle après déploiement : répond 200 si l'application
// tourne ET joint la base, 503 sinon. Aucune donnée, aucun identifiant : seulement ok / non.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
