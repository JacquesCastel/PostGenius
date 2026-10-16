import { prisma } from "./db";

// Compte client d'une agence ? Un client est une entreprise : il ne publie, ne commente ni ne réagit jamais avec un PROFIL personnel
// (celui connecté dans son espace est en pratique celui de la personne de l'agence qui a branché la page).
export const CLIENT_PROFILE_BLOCKED = "Dans l'espace d'un client, on agit uniquement au nom de sa page entreprise : le profil personnel connecté n'est jamais utilisé.";
export async function isClientAccount(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { agencyId: true } });
  return Boolean(u?.agencyId);
}

// Le profil personnel est-il interdit pour ce compte ? Oui pour un client d'agence, sauf si l'agence a déclaré qu'une personne de ce client
// a son propre profil à gérer (User.personalProfile) : alors client = sa page entreprise ET/OU son profil personnel.
export async function personalProfileBlocked(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { agencyId: true, personalProfile: true } });
  return Boolean(u?.agencyId && !u.personalProfile);
}
