import { prisma } from "./db";

// Accès par agence : une agence est un espace clos dont le propriétaire est le seul souscripteur.
// Ses clients et ses collaborateurs n'ont ni essai ni abonnement propres : leur accès est celui du propriétaire.
// (Un client ou un collaborateur n'est donc jamais « gratuit » une fois l'essai ou l'abonnement du propriétaire terminé.)

const SUBJECT_SELECT = { id: true, email: true, role: true, plan: true, trialEndsAt: true, subscriptionStatus: true, currentPeriodEnd: true };

// Compte dont l'essai / l'abonnement décide de l'accès de `userId` : le propriétaire de son agence (client ou collaborateur), sinon lui-même
export async function accessSubject(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...SUBJECT_SELECT, agencyId: true, agencyMembership: { select: { agencyId: true, role: true } } },
  });
  if (!u) return null;
  const agencyId = u.agencyId ?? (u.agencyMembership && u.agencyMembership.role !== "owner" ? u.agencyMembership.agencyId : null);
  if (!agencyId) return { ...u, viaAgency: false };
  const owner = await prisma.agencyMember.findFirst({ where: { agencyId, role: "owner" }, select: { user: { select: SUBJECT_SELECT } } });
  // Agence sans propriétaire connu (anomalie) : on ne bloque pas à tort, on garde le compte tel quel
  if (!owner?.user) return { ...u, viaAgency: false };
  return { ...owner.user, viaAgency: true };
}
