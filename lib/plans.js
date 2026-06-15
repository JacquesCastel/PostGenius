// Offres / plans LinkeePost — source de vérité unique (limites + tarifs).
// Fichier PUR (aucune dépendance serveur) : importable côté client comme serveur.

export const PLANS = {
  essentiel: {
    id: "essentiel",
    name: "Essentiel",
    price: 29,
    postsPerMonth: 15, // quota mensuel de posts générés
    imagesPerMonth: 0, // pas d'images IA
    campaigns: false, // pas d'outil de campagne
    veille: false, // pas de veille connectée
    orgPublish: false, // pas de publication page entreprise
    orgStats: false,
    events: false, // pas de module Événements
    scoring: false, // pas de score d'engagement / optimisation
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 59,
    postsPerMonth: null, // illimité
    imagesPerMonth: 50,
    campaigns: true,
    veille: true,
    orgPublish: false,
    orgStats: false,
    events: false,
    scoring: true, // score d'engagement + optimisation
  },
  agence: {
    id: "agence",
    name: "Agence",
    price: 149,
    postsPerMonth: null, // illimité
    imagesPerMonth: null, // illimité
    campaigns: true,
    veille: true,
    orgPublish: true,
    orgStats: true,
    events: true, // module Événements réservé à l'offre Agence
    scoring: true,
  },
};

// Plans choisissables à l'inscription (ordre d'affichage)
export const PLAN_IDS = ["essentiel", "pro", "agence"];
export const DEFAULT_PLAN = "pro"; // si inscription sans choix explicite
export const TRIAL_DAYS = 14;

export function isPlanId(id) {
  return Object.prototype.hasOwnProperty.call(PLANS, id);
}

export function planOf(user) {
  return PLANS[user?.plan] || PLANS[DEFAULT_PLAN];
}

export function planLabel(id) {
  return PLANS[id]?.name || id;
}

// null = illimité
export function postsLimit(user) {
  return planOf(user).postsPerMonth;
}
export function imagesLimit(user) {
  return planOf(user).imagesPerMonth;
}

// feature ∈ campaigns | veille | orgPublish | orgStats
export function planAllows(user, feature) {
  return Boolean(planOf(user)[feature]);
}

// Jours d'essai restants (null si pas d'essai en cours)
export function trialDaysLeft(user) {
  if (!user?.trialEndsAt) return null;
  const days = Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / 86400000);
  return days > 0 ? days : 0;
}

// État d'accès : "active" (abonné) | "past_due" (impayé, tolérance) | "trial" | "expired"
export function accessState(user) {
  const status = user?.subscriptionStatus;
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due"; // tolérance le temps de régulariser
  // Pas de date d'essai connue (comptes historiques) → on ne bloque pas
  if (!user?.trialEndsAt) return "trial";
  const left = trialDaysLeft(user);
  if (left != null && left > 0) return "trial";
  return "expired";
}

// Accès autorisé tant que l'essai court OU qu'un abonnement est vivant
export function hasActiveAccess(user) {
  return accessState(user) !== "expired";
}
