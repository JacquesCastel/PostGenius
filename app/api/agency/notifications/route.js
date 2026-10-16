import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/agency";

// GET /api/agency/notifications — les notifications de l'utilisateur connecté (les plus récentes d'abord) et le nombre de non lues
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const where = { userId: auth.userId, agencyId: auth.agencyId };
  const [items, unread] = await Promise.all([
    prisma.agencyNotification.findMany({
      where, orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, kind: true, title: true, body: true, clientId: true, view: true, createdAt: true, readAt: true },
    }),
    prisma.agencyNotification.count({ where: { ...where, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

// POST /api/agency/notifications { id } marque une notification lue ; { all: true } les marque toutes lues
export async function POST(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => ({}));
  const where = { userId: auth.userId, agencyId: auth.agencyId, readAt: null, ...(body.all ? {} : { id: String(body.id ?? "") }) };
  if (!body.all && !body.id) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const { count } = await prisma.agencyNotification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true, count });
}
