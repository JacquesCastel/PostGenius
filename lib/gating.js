// Application des limites d'offre (côté serveur, accès base).
// Chaque fonction renvoie { ok: true } ou { ok: false, error: "..." }.

import { prisma } from "./db";
import { postsLimit, imagesLimit, knowledgeLimit, planAllows, hasActiveAccess, planOf, planWith, upgradeTarget, PLANS, PLAN_IDS } from "./plans";
import { isAdminUser } from "./admin";
import { effectiveLimits } from "./quotas";
import { accessSubject } from "./agencyAccess";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function planUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, trialEndsAt: true, subscriptionStatus: true, currentPeriodEnd: true, quotaOverrides: true },
  });
}

// Accès actif requis (essai en cours OU abonnement vivant). Les admins sont exemptés.
export async function checkAccess(userId) {
  // Tant que le paiement n'est pas configuré, on ne bloque personne (déploiement sûr).
  if (!process.env.STRIPE_SECRET_KEY) return { ok: true };
  // Client ou collaborateur d'une agence : l'accès est celui du propriétaire de l'agence (voir lib/agencyAccess.js)
  const user = await accessSubject(userId);
  if (!user) return { ok: false, error: "Compte introuvable.", code: "no_user" };
  if (isAdminUser(user)) return { ok: true };
  if (hasActiveAccess(user)) return { ok: true };
  return {
    ok: false,
    error: user.viaAgency
      ? "L'accès de votre agence est suspendu : son essai gratuit ou son abonnement est terminé. Le propriétaire de l'agence doit s'abonner pour le rétablir."
      : "Votre essai gratuit est terminé. Abonnez-vous pour continuer à utiliser LinkeePost.",
    code: "trial_expired",
  };
}

// Quota mensuel de posts (Essentiel = 15 ; Pro/Agence = illimité)
export async function checkPostQuota(userId) {
  const user = await planUser(userId);
  const limit = (await effectiveLimits(userId)).postsPerMonth;
  if (limit == null) return { ok: true };
  const used = await prisma.draft.count({
    where: { userId, createdAt: { gte: monthStart() } },
  });
  if (used >= limit) {
    return {
      ok: false,
      error: user?.quotaOverrides?.postsPerMonth !== undefined
        ? `Le quota de posts fixé pour ce compte est atteint (${limit} par mois). Contactez l'agence ou l'administrateur pour l'augmenter.`
        : `Limite de votre offre atteinte (${limit} posts/mois). Passez à une offre supérieure pour continuer.`,
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
  const limit = (await effectiveLimits(userId)).imagesPerMonth;
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
    return { ok: false, error: user?.quotaOverrides?.imagesPerMonth !== undefined ? `Le quota d'images fixé pour ce compte est atteint (${limit} par mois). Contactez l'agence ou l'administrateur pour l'augmenter.` : `Limite d'images de votre offre atteinte (${limit}/mois).`, code: "images_limit", limit, upgradeTo: upgradeTarget(planOf(user).id, "images") };
  }
  return { ok: true };
}

// Quota mensuel de dictée vocale, en secondes transcrites (Essentiel = 10 min ; Pro = 60 min ; Agence = 60 min par client)
export async function checkVoiceQuota(userId) {
  const user = await planUser(userId);
  const minutes = (await effectiveLimits(userId)).voiceMinutesPerMonth ?? null;
  if (minutes == null) return { ok: true, usedSeconds: 0, limitSeconds: null };
  const limitSeconds = minutes * 60;
  const agg = await prisma.usageEvent.aggregate({ where: { userId, kind: "transcription", createdAt: { gte: monthStart() } }, _sum: { seconds: true } });
  const usedSeconds = agg._sum.seconds ?? 0;
  if (usedSeconds >= limitSeconds) {
    return {
      ok: false,
      error: `Vous avez utilisé vos ${minutes} minutes de dictée vocale du mois. Écrivez votre texte au clavier, ou passez à une offre supérieure.`,
      code: "voice_limit",
      limit: minutes,
      usedSeconds,
      limitSeconds,
      upgradeTo: PLAN_IDS.slice(PLAN_IDS.indexOf(planOf(user).id) + 1).find((id) => (PLANS[id].voiceMinutesPerMonth ?? 0) > (planOf(user).voiceMinutesPerMonth ?? 0)) ?? null,
    };
  }
  return { ok: true, usedSeconds, limitSeconds };
}

// Quota mensuel de vidéo et d'audio transcrits pour « Seconde vie d'un contenu » (Pro = 120 min ; Agence = 300 min par client).
// `needSeconds` : durée du fichier à traiter ; refusé s'il ne reste pas assez de minutes.
export async function checkMediaQuota(userId, needSeconds = 0) {
  const user = await planUser(userId);
  const minutes = (await effectiveLimits(userId)).mediaMinutesPerMonth ?? null;
  if (minutes == null) return { ok: true, usedSeconds: 0, limitSeconds: null };
  const limitSeconds = minutes * 60;
  const agg = await prisma.usageEvent.aggregate({ where: { userId, kind: "media", createdAt: { gte: monthStart() } }, _sum: { seconds: true } });
  const usedSeconds = agg._sum.seconds ?? 0;
  const left = Math.max(0, limitSeconds - usedSeconds);
  if (left <= 0 || needSeconds > left) {
    return {
      ok: false,
      error: left <= 0
        ? `Vous avez utilisé vos ${minutes} minutes de vidéo et d'audio du mois. Collez plutôt la transcription du contenu, ou passez à une offre supérieure.`
        : `Ce fichier dure ${Math.ceil(needSeconds / 60)} min et il vous reste ${Math.floor(left / 60)} min de vidéo et d'audio ce mois-ci. Collez plutôt la transcription du contenu, ou passez à une offre supérieure.`,
      code: "media_limit",
      limit: minutes,
      usedSeconds,
      limitSeconds,
      upgradeTo: PLAN_IDS.slice(PLAN_IDS.indexOf(planOf(user).id) + 1).find((id) => (PLANS[id].mediaMinutesPerMonth ?? 0) > (planOf(user).mediaMinutesPerMonth ?? 0)) ?? null,
    };
  }
  return { ok: true, usedSeconds, limitSeconds, leftSeconds: left };
}

// Nombre de sources de la base de connaissances (Essentiel = 5 ; Pro = 30 ; Agence = 100)
export async function checkKnowledgeQuota(userId) {
  const user = await planUser(userId);
  const limit = (await effectiveLimits(userId)).knowledgeSources ?? Infinity;
  const used = await prisma.knowledgeSource.count({ where: { userId } });
  if (used >= limit) {
    return {
      ok: false,
      error: user?.quotaOverrides?.knowledgeSources !== undefined
        ? `Le quota de sources fixé pour ce compte est atteint (${limit}). Supprimez une source ou contactez l'agence ou l'administrateur.`
        : `Limite de votre offre atteinte (${limit} sources). Supprimez une source ou passez à une offre supérieure.`,
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
