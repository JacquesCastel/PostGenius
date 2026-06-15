// Crée les produits + prix (mensuel & annuel) sur Stripe, puis imprime les lignes .env.
// À lancer UNE FOIS par environnement (test, puis live) depuis ~/linkedin :
//   node --env-file=.env scripts/stripe-setup.mjs
// (utilise la STRIPE_SECRET_KEY du .env : sk_test_... en test, sk_live_... en prod)
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("❌ STRIPE_SECRET_KEY manquant dans .env");
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";

// Montants en centimes (HT). Annuel = 10 mois (2 mois offerts).
const PLANS = [
  { id: "essentiel", name: "LinkeePost Essentiel", month: 2900, year: 29000 },
  { id: "pro", name: "LinkeePost Pro", month: 5900, year: 59000 },
  { id: "agence", name: "LinkeePost Agence", month: 14900, year: 149000 },
];

console.log(`\n🔧 Création des produits/prix Stripe (${mode})…\n`);
const out = {};

for (const p of PLANS) {
  const product = await stripe.products.create({ name: p.name, metadata: { plan: p.id } });
  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: p.month,
    currency: "eur",
    recurring: { interval: "month" },
    metadata: { plan: p.id, interval: "month" },
  });
  const yearly = await stripe.prices.create({
    product: product.id,
    unit_amount: p.year,
    currency: "eur",
    recurring: { interval: "year" },
    metadata: { plan: p.id, interval: "year" },
  });
  out[`STRIPE_PRICE_${p.id.toUpperCase()}_MONTH`] = monthly.id;
  out[`STRIPE_PRICE_${p.id.toUpperCase()}_YEAR`] = yearly.id;
  console.log(`  ✅ ${p.name} : ${(p.month / 100).toFixed(0)} €/mois · ${(p.year / 100).toFixed(0)} €/an`);
}

console.log("\n# ───────── À coller dans .env ─────────");
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
console.log("# ──────────────────────────────────────\n");
