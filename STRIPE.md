# Intégration Stripe — LinkeePost

Paiement par **abonnement** via **Stripe Checkout** (page hébergée) + **portail client** (gestion/annulation/factures). L'essai 14 jours reste **sans carte** ; le paiement n'est demandé qu'au moment de s'abonner.

## 1. Variables d'environnement (`.env`)

```bash
# Clés API Stripe (TEST d'abord : sk_test_..., puis LIVE : sk_live_...)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# URL publique de l'app (pour les redirections Checkout/portail)
APP_URL=https://postgenius.network

# Price IDs (générés par scripts/stripe-setup.mjs)
STRIPE_PRICE_ESSENTIEL_MONTH=price_xxx
STRIPE_PRICE_ESSENTIEL_YEAR=price_xxx
STRIPE_PRICE_PRO_MONTH=price_xxx
STRIPE_PRICE_PRO_YEAR=price_xxx
STRIPE_PRICE_AGENCE_MONTH=price_xxx
STRIPE_PRICE_AGENCE_YEAR=price_xxx
```

> Tant que `STRIPE_SECRET_KEY` est absente, l'app fonctionne normalement mais les boutons d'abonnement renvoient « paiement non configuré ». Aucune clé n'est requise au build.

## 2. Installation et schéma

```bash
npm install                       # installe le paquet stripe
npx prisma db push                # ajoute les champs Stripe au modèle User
```

## 3. Créer les produits et les prix

Dans le dashboard Stripe, passe en **mode Test**, récupère ta clé secrète de test dans `.env`, puis :

```bash
node --env-file=.env scripts/stripe-setup.mjs
```

Le script crée 3 produits (Essentiel/Pro/Agence) × 2 prix (mensuel/annuel : annuel = 10 mois, 2 offerts) et imprime les 6 lignes `STRIPE_PRICE_*` à coller dans `.env`.

## 4. Webhook

Crée un endpoint dans Stripe → Developers → Webhooks :

- URL : `https://postgenius.network/api/stripe/webhook`
- Événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copie le **Signing secret** (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.

**Test en local** (sans déployer) :

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# colle le whsec_... affiché dans .env, puis relance `npm run dev`
```

## 5. Tester le flux

1. Connecte-toi à l'app → onglet **Abonnement**.
2. Choisis Mensuel/Annuel puis **S'abonner** → page Stripe Checkout.
3. Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.
4. Retour sur `/app?billing=success` → le webhook met à jour `plan` + `subscriptionStatus`.
5. **Gérer mon abonnement** ouvre le portail (changer d'offre, annuler, factures).

## 6. Passage en LIVE

1. Bascule le dashboard Stripe en **mode Live**, mets les clés `sk_live_...` / `whsec_...` (endpoint live) dans le `.env` de prod.
2. Relance `node --env-file=.env scripts/stripe-setup.mjs` (en live) et remplace les `STRIPE_PRICE_*`.
3. Recrée le webhook en mode live avec l'URL de prod.

## Blocage à la fin de l'essai

- Tant que l'essai court **ou** qu'un abonnement est vivant (`active`/`trialing`/`past_due`), l'accès est complet.
- À la fin de l'essai **sans** abonnement actif, l'app affiche un **écran de blocage (paywall)** avec les offres : l'utilisateur ne peut que s'abonner ou se déconnecter. Ses données sont conservées.
- Côté serveur, `checkAccess()` protège les routes coûteuses (`/api/generate`, `/api/drafts`, `/api/image/generate`) → impossible de contourner par l'API.
- **Tolérance `past_due`** : en cas d'échec de paiement, l'accès est maintenu avec un bandeau d'alerte (« Régulariser ») le temps que Stripe relance le prélèvement.
- Un **bandeau** prévient aussi quand il reste ≤ 5 jours d'essai.
- **Les admins** (rôle `admin` ou `ADMIN_EMAILS`) ne sont jamais bloqués. Les comptes historiques sans `trialEndsAt` non plus (pas de coupure rétroactive).

## Notes / pistes d'évolution

- Il n'y a pas d'offre gratuite : le compte est en lecture/abonnement requis après l'essai.
- TVA : les montants sont en HT. Activer **Stripe Tax** si besoin de gérer la TVA automatiquement.
