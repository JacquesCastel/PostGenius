// Repère les clients Stripe qui ont plusieurs abonnements vivants (facturés deux fois) — LECTURE SEULE, ne modifie rien.
// Usage : STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-duplicate-subs.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY manquante.");
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
const LIVE = new Set(["active", "trialing", "past_due"]);

const byCustomer = new Map();
for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
  if (!LIVE.has(sub.status)) continue;
  const list = byCustomer.get(sub.customer) ?? [];
  list.push(sub);
  byCustomer.set(sub.customer, list);
}

let found = 0;
for (const [customer, subs] of byCustomer) {
  if (subs.length < 2) continue;
  found++;
  console.log(`\nClient ${customer} : ${subs.length} abonnements vivants`);
  for (const s of subs) {
    const price = s.items.data[0]?.price;
    const amount = price?.unit_amount != null ? `${price.unit_amount / 100} ${String(price.currency).toUpperCase()}/${price.recurring?.interval}` : "?";
    console.log(`  - ${s.id} · ${s.status} · ${amount} · créé le ${new Date(s.created * 1000).toLocaleDateString("fr-FR")}`);
  }
}
console.log(found ? `\n${found} client(s) concerné(s). Résiliez l'abonnement en trop depuis le tableau de bord Stripe (avec remboursement au prorata si besoin).` : "Aucun client avec plusieurs abonnements vivants.");
