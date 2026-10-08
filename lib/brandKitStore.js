import { prisma } from "./db";

// Charte graphique d'une entreprise (contextId nul = entreprise principale). Une seule charte par couple
// (compte, entreprise) : garantie ici plutôt que par une contrainte, car « nul » n'est pas unique en base.
export const findKit = (userId, contextId = null) =>
  prisma.brandKit.findFirst({ where: { userId, contextId: contextId ?? null }, orderBy: { id: "asc" } });

export async function saveKit(userId, contextId, data) {
  const existing = await findKit(userId, contextId);
  if (existing) return prisma.brandKit.update({ where: { id: existing.id }, data });
  return prisma.brandKit.create({ data: { userId, contextId: contextId ?? null, ...data } });
}
