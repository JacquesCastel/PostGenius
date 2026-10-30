import { prisma } from "./db";
import { PLANS, planOf } from "./plans";

// Limites effectives d'un compte : valeurs de l'offre (lib/plans.js), modifiées par l'administration (PlanConfig),
// puis par les réglages propres au compte (User.quotaOverrides : administrateur, ou agence pour ses clients).
// null = illimité. -1 dans une surcharge = illimité.
export const QUOTA_KEYS = ["postsPerMonth", "imagesPerMonth", "knowledgeSources"];
// Clés réglables (administration, agence) : les trois ressources alertées par e-mail + la dictée vocale (minutes par mois)
export const SETTABLE_KEYS = [...QUOTA_KEYS, "voiceMinutesPerMonth", "mediaMinutesPerMonth"];
export const QUOTA_LABELS = { postsPerMonth: "Posts par mois", imagesPerMonth: "Images IA par mois", knowledgeSources: "Sources de connaissances" };
const MAX_LIMIT = 100000;

// Réglages reçus (formulaire) → { clé: nombre | -1 } ; les champs vides ou invalides sont ignorés
export function cleanQuotaInput(raw) {
  const out = {};
  for (const k of SETTABLE_KEYS) {
    const v = raw?.[k];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out[k] = n < 0 ? -1 : Math.min(MAX_LIMIT, Math.floor(n));
  }
  return out;
}

let cache = { at: 0, byPlan: {} };
async function planConfigs() {
  if (Date.now() - cache.at < 30_000) return cache.byPlan;
  const rows = await prisma.planConfig.findMany().catch(() => []);
  cache = { at: Date.now(), byPlan: Object.fromEntries(rows.map((r) => [r.planId, r.limits ?? {}])) };
  return cache.byPlan;
}
export const forgetPlanConfigs = () => { cache = { at: 0, byPlan: {} }; };

export const applyOverrides = (limits, overrides) => {
  const out = { ...limits };
  for (const k of SETTABLE_KEYS) if (overrides?.[k] !== undefined) out[k] = overrides[k] < 0 ? null : overrides[k];
  return out;
};

// Limites de l'offre seule (code + administration), sans réglage de compte
export async function planLimits(planId) {
  const base = planOf({ plan: planId });
  const cfg = (await planConfigs())[base.id];
  return applyOverrides({ postsPerMonth: base.postsPerMonth, imagesPerMonth: base.imagesPerMonth, knowledgeSources: base.knowledgeSources, voiceMinutesPerMonth: base.voiceMinutesPerMonth ?? null, mediaMinutesPerMonth: base.mediaMinutesPerMonth ?? null }, cfg);
}

// Limites effectives du compte
export async function effectiveLimits(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, quotaOverrides: true } });
  const plan = await planLimits(u?.plan);
  return applyOverrides(plan, u?.quotaOverrides);
}

// Limites par défaut (code) de chaque offre, pour l'écran d'administration
export const CODE_LIMITS = Object.fromEntries(Object.values(PLANS).map((p) => [p.id, { postsPerMonth: p.postsPerMonth, imagesPerMonth: p.imagesPerMonth, knowledgeSources: p.knowledgeSources, voiceMinutesPerMonth: p.voiceMinutesPerMonth ?? null, mediaMinutesPerMonth: p.mediaMinutesPerMonth ?? null }]));

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Consommation du mois en cours
export async function usageOf(userId) {
  const [posts, images, knowledge, voice, media] = await Promise.all([
    prisma.draft.count({ where: { userId, createdAt: { gte: monthStart() } } }),
    prisma.usageEvent.aggregate({ where: { userId, kind: "image", createdAt: { gte: monthStart() } }, _sum: { images: true } }),
    prisma.knowledgeSource.count({ where: { userId } }),
    prisma.usageEvent.aggregate({ where: { userId, kind: "transcription", createdAt: { gte: monthStart() } }, _sum: { seconds: true } }),
    prisma.usageEvent.aggregate({ where: { userId, kind: "media", createdAt: { gte: monthStart() } }, _sum: { seconds: true } }),
  ]);
  return { postsPerMonth: posts, imagesPerMonth: images._sum.images ?? 0, knowledgeSources: knowledge, voiceMinutesPerMonth: Math.ceil((voice._sum.seconds ?? 0) / 60), mediaMinutesPerMonth: Math.ceil((media._sum.seconds ?? 0) / 60) };
}

// { limits, usage } réunis, pour la jauge et les alertes
export async function quotaStatus(userId) {
  const [limits, usage] = await Promise.all([effectiveLimits(userId), usageOf(userId)]);
  return { limits, usage };
}
