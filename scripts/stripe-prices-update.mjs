// Met à jour les tarifs sur Stripe SANS toucher aux abonnements existants : un prix Stripe n'est pas modifiable, on en crée
// donc de nouveaux sur les produits existants. Les abonnés actuels gardent leur ancien prix (ils restent reconnus grâce à
// STRIPE_LEGACY_PRICES), les nouveaux abonnements prennent les nouveaux prix.
//
// Tarifs visés (HT) : Essentiel 19 €/mois · 171 €/an ; Pro 49 €/mois · 441 €/an ; Agence 129 €/mois · 1 161 €/an (annuel = 9 mois).
//
// Simulation par défaut (aucune écriture) ; --apply crée les prix. La bibliothèque Stripe est empaquetée dans l'application et
// absente du conteneur : on l'installe d'abord dans un dossier temporaire, puis on lance le script depuis ce dossier (le conteneur
// fournit la clé Stripe et les identifiants de prix actuels) :
//   cd /opt/postgenius
//   docker compose exec -T app sh -c 'mkdir -p /tmp/s && cd /tmp/s && npm_config_cache=/tmp/npmcache npm init -y >/dev/null 2>&1 && npm_config_cache=/tmp/npmcache npm i stripe@17 --silent --no-audit --no-fund && echo "stripe installé"'
//   docker compose exec -T app sh -c 'cd /tmp/s && node --input-type=module -' < scripts/stripe-prices-update.mjs            # simulation
//   docker compose exec -T app sh -c 'cd /tmp/s && node --input-type=module - --apply' < scripts/stripe-prices-update.mjs     # création
// Le script imprime ensuite les lignes à mettre dans le .env du serveur (nouveaux prix + STRIPE_LEGACY_PRICES).
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("❌ STRIPE_SECRET_KEY manquant"); process.exit(1); }
const stripe = new Stripe(key);
const apply = process.argv.includes("--apply");
console.log(`\nMode Stripe : ${key.startsWith("sk_live") ? "LIVE (production)" : "TEST"} · ${apply ? "ÉCRITURE" : "simulation"}\n`);

const TARGET = {
  essentiel: { month: 1900, year: 17100 },
  pro: { month: 4900, year: 44100 },
  agence: { month: 12900, year: 116100 },
};

const env = {};
const legacy = [];
for (const [plan, amounts] of Object.entries(TARGET)) {
  for (const interval of ["month", "year"]) {
    const envName = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
    const currentId = process.env[envName];
    if (!currentId) { console.log(`! ${envName} absent : ignoré`); continue; }
    const current = await stripe.prices.retrieve(currentId);
    const want = amounts[interval];
    if (current.unit_amount === want) {
      console.log(`= ${plan} ${interval} : ${want / 100} € déjà en place (${currentId})`);
      continue;
    }
    console.log(`${apply ? "+" : "·"} ${plan} ${interval} : ${current.unit_amount / 100} € → ${want / 100} €`);
    legacy.push(`${currentId}:${plan}:${interval}`);
    if (!apply) continue;
    const created = await stripe.prices.create({
      product: typeof current.product === "string" ? current.product : current.product.id,
      unit_amount: want,
      currency: current.currency,
      recurring: { interval },
      metadata: { plan, interval },
    });
    env[envName] = created.id;
  }
}

if (!apply) {
  console.log("\nSimulation terminée : relancez avec --apply pour créer les prix.");
} else {
  console.log("\n# ───────── À mettre dans le .env du serveur ─────────");
  for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`);
  const prev = String(process.env.STRIPE_LEGACY_PRICES ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  console.log(`STRIPE_LEGACY_PRICES=${[...prev, ...legacy].join(",")}`);
  console.log("# ─────────────────────────────────────────────────────\n");
  console.log("Puis redéployez (./deploy.sh) : tant que le .env n'est pas modifié, les anciens prix restent actifs.");
}
