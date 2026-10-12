import { prisma } from "./db";

// Compte client d'une agence ? Un client est une entreprise : il ne publie, ne commente ni ne réagit jamais avec un PROFIL personnel
// (celui connecté dans son espace est en pratique celui de la personne de l'agence qui a branché la page).
export const CLIENT_PROFILE_BLOCKED = "Dans l'espace d'un client, on agit uniquement au nom de sa page entreprise : le profil personnel connecté n'est jamais utilisé.";
export async function isClientAccount(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { agencyId: true } });
  return Boolean(u?.agencyId);
}
