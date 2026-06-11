import { prisma } from "./db";

// Suivi de la consommation IA — enregistré en tâche de fond (non bloquant)

export function logUsage(userId, { kind = "claude", context = null, inputTokens = 0, outputTokens = 0, images = 0 }) {
  if (!userId) return;
  prisma.usageEvent
    .create({ data: { userId, kind, context, inputTokens, outputTokens, images } })
    .catch((e) => console.error("[usage]", e.message));
}

// Tarifs estimatifs (USD) — à ajuster selon les prix réels des fournisseurs
export const PRICING = { inputPerMTok: 3, outputPerMTok: 15, perImage: 0.04 };

export function estimateCost({ inputTokens = 0, outputTokens = 0, images = 0 }) {
  return (
    (inputTokens / 1e6) * PRICING.inputPerMTok +
    (outputTokens / 1e6) * PRICING.outputPerMTok +
    images * PRICING.perImage
  );
}
