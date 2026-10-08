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
    knowledgeSources: 5, // sources de la base de connaissances
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
    knowledgeSources: 30,
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
    knowledgeSources: 100, // par client géré (la base est propre à chaque compte)
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
export function knowledgeLimit(user) {
  return planOf(user).knowledgeSources ?? 0;
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

// Nature d'un changement d'offre (pour l'abonné qui a déjà un abonnement vivant) :
//   "upgrade"   : offre supérieure, ou passage du mensuel à l'annuel → effet immédiat, différence facturée au prorata
//   "downgrade" : offre inférieure, ou passage de l'annuel au mensuel → effet à la fin de la période déjà payée
//   "same"      : déjà cette offre et cette périodicité
export function changeKind(from, to) {
  const a = PLAN_IDS.indexOf(from.plan);
  const b = PLAN_IDS.indexOf(to.plan);
  if (a !== b) return b > a ? "upgrade" : "downgrade";
  if (from.interval === to.interval) return "same";
  return to.interval === "year" ? "upgrade" : "downgrade";
}

// Ce que l'on perd (clés lisibles) en passant de l'offre `from` à l'offre `to`
export function lostFeatures(fromId, toId) {
  const a = PLANS[fromId];
  const b = PLANS[toId];
  if (!a || !b) return [];
  const out = [];
  const flag = (key, label) => { if (a[key] && !b[key]) out.push(label); };
  flag("campaigns", "l'outil de campagne");
  flag("veille", "la veille connectée");
  flag("scoring", "le score d'engagement");
  flag("orgPublish", "la publication sur page entreprise");
  flag("orgStats", "les statistiques de page");
  flag("events", "le module Événements");
  if (a.postsPerMonth == null && b.postsPerMonth != null) out.push(`les posts illimités (${b.postsPerMonth} par mois)`);
  if ((a.imagesPerMonth ?? Infinity) > (b.imagesPerMonth ?? 0) && b.imagesPerMonth !== a.imagesPerMonth) {
    out.push(b.imagesPerMonth === 0 ? "les images IA" : `une partie des images IA (${b.imagesPerMonth} par mois)`);
  }
  if ((a.knowledgeSources ?? 0) > (b.knowledgeSources ?? 0)) out.push(`des sources de connaissances (${b.knowledgeSources} au lieu de ${a.knowledgeSources})`);
  return out;
}
