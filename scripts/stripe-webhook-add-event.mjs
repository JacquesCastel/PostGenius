// Ajoute des événements à l'endpoint webhook Stripe, sans toucher aux existants.
// Usage (sur le serveur, dans le conteneur, la clé vient de l'environnement) :
//   docker compose exec -T app node scripts/stripe-webhook-add-event.mjs
// Sans argument : ajoute invoice.payment_failed. Sinon : liste d'événements en arguments.
// Le script n'affiche jamais la clé.

const ENDPOINT = process.env.STRIPE_WEBHOOK_ENDPOINT_ID || "we_1UKdfzGZ3Tt1uU5OiKBLfePH";
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY absente de l'environnement.");
  process.exit(1);
}

const toAdd = process.argv.length > 2 ? process.argv.slice(2) : ["invoice.payment_failed"];
const url = `https://api.stripe.com/v1/webhook_endpoints/${ENDPOINT}`;
const auth = { Authorization: `Bearer ${key}` };

async function call(body) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { ...auth, "Content-Type": "application/x-www-form-urlencoded" } : auth,
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Erreur Stripe :", json.error?.message || res.status);
    process.exit(1);
  }
  return json;
}

const before = await call();
console.log("Avant :", before.status, before.enabled_events.join(", "));

const wanted = [...new Set([...before.enabled_events, ...toAdd])];
if (before.enabled_events.includes("*")) {
  console.log("L'endpoint écoute déjà tous les événements (*), rien à faire.");
} else if (wanted.length === before.enabled_events.length) {
  console.log("Les événements demandés sont déjà présents, rien à modifier.");
} else {
  const body = new URLSearchParams();
  for (const e of wanted) body.append("enabled_events[]", e);
  await call(body.toString());
}

const after = await call();
console.log("Après :", after.status, `(${after.enabled_events.length} événements)`);
for (const e of after.enabled_events) console.log(" -", e);

const ok = after.status === "enabled" && toAdd.every((e) => after.enabled_events.includes(e) || after.enabled_events.includes("*"));
console.log(ok ? "OK : endpoint enabled, événements présents." : "ATTENTION : état inattendu.");
process.exit(ok ? 0 : 1);
