import Stripe from "stripe";

// Client Stripe (initialisation paresseuse — pas de clé requise au build).
let _stripe = null;
export function stripe() {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY manquant");
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  return _stripe;
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// URL publique de l'app (pour les redirections Checkout / portail)
export function appUrl() {
  return (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
}

// Correspondance plan × intervalle → variable d'env contenant le price ID Stripe
const PRICE_ENV = {
  essentiel: { month: "STRIPE_PRICE_ESSENTIEL_MONTH", year: "STRIPE_PRICE_ESSENTIEL_YEAR" },
  pro: { month: "STRIPE_PRICE_PRO_MONTH", year: "STRIPE_PRICE_PRO_YEAR" },
  agence: { month: "STRIPE_PRICE_AGENCE_MONTH", year: "STRIPE_PRICE_AGENCE_YEAR" },
};

// price ID Stripe pour un plan + intervalle ("month" | "year")
export function priceIdFor(plan, interval) {
  const itv = interval === "year" ? "year" : "month";
  const key = PRICE_ENV[plan]?.[itv];
  return key ? process.env[key] || null : null;
}

// Retrouve { plan, interval } à partir d'un price ID (pour les webhooks)
export function planFromPriceId(priceId) {
  for (const plan of Object.keys(PRICE_ENV)) {
    for (const interval of ["month", "year"]) {
      const val = process.env[PRICE_ENV[plan][interval]];
      if (val && val === priceId) return { plan, interval };
    }
  }
  return null;
}
