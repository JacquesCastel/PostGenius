import { prisma } from "../db";

// Piliers éditoriaux — catégories de contenu personnalisables utilisées pour
// équilibrer les recommandations (cf. generateRecommendations). Semés une
// fois par utilisateur avec des valeurs par défaut, librement renommables/
// supprimables ensuite (l'IA peut aussi en proposer de nouveaux).

export const DEFAULT_PILLARS = [
  { name: "Expertise", description: "Démonstration de savoir-faire, analyse d'expert" },
  { name: "Opinion", description: "Prise de position, point de vue tranché" },
  { name: "Pédagogie", description: "Expliquer, transmettre une méthode ou un concept" },
  { name: "Cas client", description: "Retour d'expérience, résultat concret obtenu" },
  { name: "Coulisses", description: "Quotidien, envers du décor, processus interne" },
  { name: "Personal branding", description: "Parcours personnel, anecdote, valeurs" },
  { name: "Actualité", description: "Réaction à une actualité du secteur" },
  { name: "Offre", description: "Présentation d'un produit, service ou offre" },
  { name: "Vision", description: "Vision long terme, tendances, prospective" },
  { name: "Expérience personnelle", description: "Vécu, apprentissage tiré d'une situation" },
];

// Crée les piliers par défaut s'il n'en existe aucun pour l'utilisateur.
// Idempotent — sans effet si l'utilisateur a déjà des piliers (par défaut ou non).
export async function ensurePillars(userId) {
  const count = await prisma.editorialPillar.count({ where: { userId } });
  if (count > 0) return;
  await prisma.editorialPillar.createMany({
    data: DEFAULT_PILLARS.map((p) => ({ userId, name: p.name, description: p.description, isDefault: true })),
    skipDuplicates: true,
  });
}

export async function getPillars(userId) {
  await ensurePillars(userId);
  return prisma.editorialPillar.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

// Retrouve un pilier par son nom (insensible à la casse) ou le crée si l'IA
// en propose un nouveau qui n'existe pas encore.
export async function findOrCreatePillar(userId, name) {
  const clean = (name || "").trim();
  if (!clean) return null;
  const existing = await prisma.editorialPillar.findFirst({
    where: { userId, name: { equals: clean, mode: "insensitive" } },
  });
  if (existing) return existing;
  try {
    return await prisma.editorialPillar.create({ data: { userId, name: clean } });
  } catch {
    // Collision de nom concurrente (@@unique) — on relit
    return prisma.editorialPillar.findFirst({ where: { userId, name: { equals: clean, mode: "insensitive" } } });
  }
}
