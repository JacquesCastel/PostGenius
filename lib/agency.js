import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// Agence : une entreprise (Agency) qui a 1 à n utilisateurs (AgencyMember) et gère des clients (User.agencyId).
// Le compte qui souscrit l'offre Agence en est le propriétaire ; l'agence est créée à sa première utilisation.
export const MAX_AGENCY_MEMBERS = 5; // au-delà : sur contact

// Agence d'un utilisateur : son appartenance, ou — s'il est sur l'offre Agence sans agence encore créée — une nouvelle agence dont il est propriétaire
export async function agencyOf(userId) {
  const member = await prisma.agencyMember.findUnique({ where: { userId }, select: { agencyId: true, role: true } });
  if (member) return member;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, companyName: true, name: true } });
  if (!user || user.plan !== "agence") return null;
  try {
    const agency = await prisma.agency.create({
      data: { name: user.companyName || user.name || "Mon agence", members: { create: { userId, role: "owner" } } },
      select: { id: true },
    });
    return { agencyId: agency.id, role: "owner" };
  } catch {
    // création simultanée : l'autre requête a gagné
    return prisma.agencyMember.findUnique({ where: { userId }, select: { agencyId: true, role: true } });
  }
}

// Garde des routes /api/agency : { userId, agencyId, role } ou { error, status }
export async function requireAgency(req) {
  const userId = await getUserId(req);
  if (!userId) return { error: "Non connecté", status: 401 };
  const a = await agencyOf(userId);
  if (!a) return { error: "Réservé au plan Agence", status: 403 };
  return { userId, agencyId: a.agencyId, role: a.role };
}

// Le client appartient-il à cette agence ?
export async function ownClient(agencyId, clientId, select = { id: true }) {
  if (!clientId) return null;
  return prisma.user.findFirst({ where: { id: clientId, agencyId }, select });
}
