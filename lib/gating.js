// Application des limites d'offre (côté serveur, accès base).
// Chaque fonction renvoie { ok: true } ou { ok: false, error: "..." }.

import { prisma } from "./db";
import { postsLimit, imagesLimit, knowledgeLimit, planAllows, hasActiveAccess, planOf, planWith, upgradeTarget } from "./plans";
import { isAdminUser } from "./admin";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function planUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, trialEndsAt: true, subscriptionStatus: true, currentPeriodEnd: true },
  });
}

// Accès actif requis (essai en cours OU abonnement vivant). Les admins sont exemptés.
export async function checkAccess(userId) {
  // Tant que le paiement n'est pas configuré, on ne bloque personne (déploiement sûr).
  if (!process.env.STRIPE_SECRET_KEY) return { ok: true };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, trialEndsAt: true, subscriptionStatus: true },
  });
  if (!user) return { ok: false, error: "Compte introuvable.", code: "no_user" };
  if (isAdminUser(user)) return { ok: true };
  if (hasActiveAccess(user)) return { ok: true };
  return {
    ok: false,
    error: "Votre essai gratuit est terminé. Abonnez-vous pour continuer à utiliser LinkeePost.",
    code: "trial_expired",
  };
}

// Quota mensuel de posts (Essentiel = 15 ; Pro/Agence = illimité)
export async function checkPostQuota(userId) {
  const user = await planUser(userId);
  const limit = postsLimit(user);
  if (limit == null) return { ok: true };
  const used = await prisma.draft.count({
    where: { userId, createdAt: { gte: monthStart() } },
  });
  if (used >= limit) {
    return {
      ok: false,
      error: `Limite de votre offre atteinte (${limit} posts/mois). Passez à une offre supérieure pour continuer.`,
      code: "posts_limit",
      limit,
      upgradeTo: upgradeTarget(planOf(user).id, "posts"),
    };
  }
  return { ok: true };
}

// Quota mensuel d'images (Essentiel = aucune ; Pro = 50 ; Agence = illimité)
export async function checkImageQuota(userId) {
  const user = await planUser(userId);
  const limit = imagesLimit(user);
  if (limit === 0) {
    return {
      ok: false,
      error: "Les images générées par IA ne sont pas incluses dans l'offre Essentiel. Passez à Pro ou Agence.",
      code: "images_limit",
      limit: 0,
      upgradeTo: upgradeTarget(planOf(user).id, "images"),
    };
  }
  if (limit == null) return { ok: true };
  const agg = await prisma.usageEvent.aggregate({
    where: { userId, kind: "image", createdAt: { gte: monthStart() } },
    _sum: { images: true },
  });
  if ((agg._sum.images ?? 0) >= limit) {
    return { ok: false, error: `Limite d'images de votre offre atteinte (${limit}/mois).`, code: "images_limit", limit, upgradeTo: upgradeTarget(planOf(user).id, "images") };
  }
  return { ok: true };
}

// Nombre de sources de la base de connaissances (Essentiel = 5 ; Pro = 30 ; Agence = 100)
export async function checkKnowledgeQuota(userId) {
  const user = await planUser(userId);
  const limit = knowledgeLimit(user);
  const used = await prisma.knowledgeSource.count({ where: { userId } });
  if (used >= limit) {
    return {
      ok: false,
      error: `Limite de votre offre atteinte (${limit} sources). Supprimez une source ou passez à une offre supérieure.`,
      code: "knowledge_limit",
      used,
      limit,
      upgradeTo: upgradeTarget(planOf(user).id, "knowledge"),
    };
  }
  return { ok: true, used, limit };
}

// Accès à une fonctionnalité réservée (campaigns | veille | orgPublish | orgStats)
export async function checkFeature(userId, feature, label) {
  const user = await planUser(userId);
  if (planAllows(user, feature)) return { ok: true };
  return {
    ok: false,
    error: `${label} n'est pas inclus dans votre offre. Passez à une offre supérieure pour y accéder.`,
    code: "feature_locked",
    feature,
    upgradeTo: planWith(feature),
  };
}

// Corps de réponse 403 d'un refus d'offre : le message, plus de quoi proposer la bonne offre à l'interface
// (code de la limite, fonction concernée, limite, offre qui la lève).
export function limitBody(r) {
  const out = { error: r.error };
  for (const k of ["code", "feature", "limit", "upgradeTo"]) if (r[k] !== undefined) out[k] = r[k];
  return out;
}
