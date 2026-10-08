import { prisma } from "./db";

// Entreprises supplémentaires d'une personne (voir lib/contextOverlay.js pour la recomposition du profil).
export const MAX_CONTEXTS = 10;
const LIMITS = { name: 120, role: 160, website: 200, businessDescription: 600, targetAudience: 250, market: 300, commGoals: 120, brandVoice: 400, themes: 250, editorialLine: 500 };

const clip = (v, n) => String(v ?? "").replace(/[ \t]+/g, " ").trim().slice(0, n);

// Champs reçus du client → champs acceptés (seuls ceux présents sont renvoyés)
export function cleanContextInput(body) {
  const out = {};
  for (const [k, max] of Object.entries(LIMITS)) {
    if (body?.[k] !== undefined) out[k] = clip(body[k], max) || (k === "name" ? "" : null);
  }
  return out;
}

// Portée d'une source reçue du client : { contextId, shared } ; lève une erreur lisible si l'entreprise n'existe pas
export async function resolveSourceScope(userId, raw) {
  const shared = raw?.shared === true || raw?.shared === "true";
  const id = raw?.contextId && raw.contextId !== "main" ? String(raw.contextId) : null;
  if (!id) return { contextId: null, shared };
  const ctx = await getContextFor(userId, id);
  if (!ctx) throw new Error("Entreprise introuvable.");
  return { contextId: ctx.id, shared };
}

// Entreprise d'une personne, ou null (id vide / inconnu / d'un autre compte)
export async function getContextFor(userId, contextId) {
  if (!userId || !contextId || typeof contextId !== "string") return null;
  return prisma.context.findFirst({ where: { id: contextId, userId } });
}
