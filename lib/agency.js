import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";

// Agence : une entreprise (Agency) qui a 1 à n utilisateurs (AgencyMember) et gère des clients (User.agencyId).
// Le compte qui souscrit l'offre Agence en est le propriétaire ; l'agence est créée à sa première utilisation.
export const MAX_AGENCY_MEMBERS = 5; // au-delà : sur contact
export const MAX_AGENCY_CLIENTS = 25; // clients gérés ; au-delà : sur contact

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

// Simple collaborateur d'une agence (ni propriétaire, ni administrateur) : pas d'accès à l'abonnement ni à la création de clients
export async function isAgencyCollaborator(userId) {
  const m = await prisma.agencyMember.findUnique({ where: { userId }, select: { role: true } });
  return Boolean(m && m.role !== "owner");
}

// Garde des routes /api/agency : { userId, agencyId, role } ou { error, status }
export async function requireAgency(req) {
  const userId = await getUserId(req);
  if (!userId) return { error: "Non connecté", status: 401 };
  const a = await agencyOf(userId);
  if (!a) return { error: "Réservé au plan Agence", status: 403 };
  const ag = await prisma.agency.findUnique({ where: { id: a.agencyId }, select: { restrictClients: true } });
  return { userId, agencyId: a.agencyId, role: a.role, restricted: Boolean(ag?.restrictClients) && a.role !== "owner" };
}

// Filtre Prisma des clients que cet utilisateur de l'agence peut voir : tous ceux de l'agence, ou — si l'agence cloisonne et qu'il n'est pas
// propriétaire — seulement ceux qui lui sont affectés. À utiliser pour toute lecture de clients (comptes User) : `where: { ...clientScope(auth) }`.
export function clientScope(auth) {
  return { agencyId: auth.agencyId, ...(auth.restricted ? { accessAsClient: { some: { memberId: auth.userId } } } : {}) };
}

// Le client est-il accessible à cet utilisateur ? (`auth` de requireAgency ; une chaîne = identifiant d'agence, sans cloisonnement)
export async function ownClient(auth, clientId, select = { id: true }) {
  if (!clientId) return null;
  const where = typeof auth === "string" ? { id: clientId, agencyId: auth } : { id: clientId, ...clientScope(auth) };
  return prisma.user.findFirst({ where, select });
}

export { isClientAccount, CLIENT_PROFILE_BLOCKED } from "@/lib/clientAccount";
