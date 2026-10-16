import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, clientScope } from "@/lib/agency";

const STATUSES = ["brouillon", "à valider", "programmé", "publié", "erreur"];

// GET /api/agency/planning?from=AAAA-MM-JJ&to=AAAA-MM-JJ&clientId=&memberId=&status=&type=
// Les posts de tous les clients que l'utilisateur voit, placés sur le calendrier : à leur date de publication si publiés,
// sinon à leur date programmée. Filtres : client, équipier affecté, statut, type de post.
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sp = new URL(req.url).searchParams;

  const from = new Date(`${sp.get("from") ?? ""}T00:00:00`);
  const to = new Date(`${sp.get("to") ?? ""}T23:59:59`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from || to - from > 100 * 86400000) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 });
  }

  const clientId = sp.get("clientId");
  const memberId = sp.get("memberId");
  const status = sp.get("status");
  const type = sp.get("type");
  if (status && !STATUSES.includes(status)) return NextResponse.json({ error: "Statut inconnu." }, { status: 400 });

  // Les filtres s'ajoutent au périmètre de l'utilisateur, ils ne l'élargissent jamais
  const userWhere = {
    ...clientScope(auth),
    ...(clientId ? { id: clientId } : {}),
    ...(memberId ? { AND: [{ accessAsClient: { some: { memberId } } }] } : {}),
  };

  const drafts = await prisma.draft.findMany({
    where: {
      user: userWhere,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      OR: [{ publishedAt: { gte: from, lte: to } }, { publishedAt: null, scheduledAt: { gte: from, lte: to } }],
    },
    select: {
      id: true, status: true, type: true, text: true, scheduledAt: true, publishedAt: true, publishError: true,
      user: { select: { id: true, name: true, companyName: true, accessAsClient: { select: { memberId: true } } } },
    },
    orderBy: [{ scheduledAt: "asc" }, { publishedAt: "asc" }],
    take: 1000,
  });

  const items = drafts.map((d) => ({
    id: d.id, status: d.status, type: d.type, text: (d.text ?? "").slice(0, 280),
    at: d.publishedAt ?? d.scheduledAt, publishError: d.publishError,
    client: { id: d.user.id, name: d.user.companyName || d.user.name },
    assignees: d.user.accessAsClient.map((a) => a.memberId),
  }));

  // Listes pour les filtres : les clients visibles ; les équipiers auxquels on peut affecter des clients (hors propriétaire, qui voit tout),
  // proposés au seul propriétaire — un équipier ne voit que ses propres clients, un filtre d'équipe ne lui servirait à rien
  const [clients, members] = await Promise.all([
    prisma.user.findMany({ where: clientScope(auth), select: { id: true, name: true, companyName: true }, orderBy: { createdAt: "asc" } }),
    auth.role === "owner"
      ? prisma.agencyMember.findMany({ where: { agencyId: auth.agencyId, role: { not: "owner" } }, orderBy: { createdAt: "asc" }, select: { role: true, user: { select: { id: true, name: true, email: true } } } })
      : [],
  ]);
  return NextResponse.json({
    items,
    clients: clients.map((c) => ({ id: c.id, name: c.companyName || c.name })),
    members: members.map((m) => ({ id: m.user.id, name: m.user.name || m.user.email, role: m.role })),
  });
}
