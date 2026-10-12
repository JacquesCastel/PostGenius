import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/agency";

// Affectation des clients aux collaborateurs — réservé au propriétaire de l'agence.
// GET : { restrict, members: [{ id, name, email, role }], access: { [clientId]: [memberId] } }
// PUT { restrict } active ou coupe le cloisonnement ; PUT { clientId, memberIds } fixe les collaborateurs d'un client.
async function owner(req) {
  const auth = await requireAgency(req);
  if (auth.error) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.role !== "owner") return { res: NextResponse.json({ error: "Seul le propriétaire de l'agence affecte les clients." }, { status: 403 }) };
  return { auth };
}

export async function GET(req) {
  const o = await owner(req);
  if (o.res) return o.res;
  const { agencyId } = o.auth;
  const [ag, members, rows] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId }, select: { restrictClients: true } }),
    prisma.agencyMember.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" }, select: { role: true, user: { select: { id: true, name: true, email: true } } } }),
    prisma.clientAccess.findMany({ where: { agencyId }, select: { clientId: true, memberId: true } }),
  ]);
  const access = {};
  for (const r of rows) (access[r.clientId] ??= []).push(r.memberId);
  return NextResponse.json({ restrict: Boolean(ag?.restrictClients), members: members.map((m) => ({ ...m.user, role: m.role })), access });
}

export async function PUT(req) {
  const o = await owner(req);
  if (o.res) return o.res;
  const { agencyId } = o.auth;
  const body = await req.json().catch(() => ({}));
  if (typeof body.restrict === "boolean") {
    await prisma.agency.update({ where: { id: agencyId }, data: { restrictClients: body.restrict } });
    return NextResponse.json({ ok: true, restrict: body.restrict });
  }
  if (typeof body.clientId === "string" && Array.isArray(body.memberIds)) {
    const client = await prisma.user.findFirst({ where: { id: body.clientId, agencyId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    // Seuls les collaborateurs de l'agence (hors propriétaire, qui voit tout) peuvent être affectés
    const valid = await prisma.agencyMember.findMany({ where: { agencyId, userId: { in: body.memberIds.map(String) }, role: { not: "owner" } }, select: { userId: true } });
    const ids = valid.map((m) => m.userId);
    await prisma.$transaction([
      prisma.clientAccess.deleteMany({ where: { agencyId, clientId: client.id, memberId: { notIn: ids } } }),
      ...ids.map((memberId) => prisma.clientAccess.upsert({ where: { clientId_memberId: { clientId: client.id, memberId } }, create: { agencyId, clientId: client.id, memberId }, update: {} })),
    ]);
    return NextResponse.json({ ok: true, memberIds: ids });
  }
  return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
}
