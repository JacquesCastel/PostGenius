# PostGenius — Générateur de posts LinkedIn (SaaS)

Application Next.js multi-clients : comptes utilisateurs (email + mot de passe), génération de posts avec l'API Claude, publication sur profil personnel et pages entreprise via l'API LinkedIn.

Fonctionnalités : inscription/connexion clients, type de post (simple / carrousel / vidéo), thématique, expertise, ton, longueur max, génération IA, brouillons en base de données (par client), publication LinkedIn (profil + page entreprise).

## 1. Installation

```bash
npm install
cp .env.example .env
# Renseigner dans .env : DATABASE_URL (Neon), AUTH_SECRET et TOKEN_ENCRYPTION_KEY
# (générer chacun avec : openssl rand -hex 32)
npx prisma db push   # crée les tables dans la base Postgres
```

Base de données : créer un projet gratuit sur https://neon.tech et copier la
connection string dans `DATABASE_URL`. En dev, utilisez une branche Neon dédiée
(« development ») pour ne pas toucher à la prod.

## 2. Obtenir une clé API Claude (génération)

1. Créer un compte sur https://console.anthropic.com
2. Ajouter du crédit (Billing) — quelques dollars suffisent pour tester
3. Menu **API Keys** → **Create Key** → copier la clé
4. La coller dans `.env` : `ANTHROPIC_API_KEY=sk-ant-...`

## 3. App LinkedIn n°1 — profil personnel

1. Aller sur https://www.linkedin.com/developers/apps → **Create app**
2. Renseigner le nom (ex : PostGenius), associer une **Page LinkedIn** et un logo
3. Onglet **Products** : demander l'accès à
   - **Share on LinkedIn** (publication, scope `w_member_social`)
   - **Sign In with LinkedIn using OpenID Connect** (identité, scopes `openid profile`)
4. Onglet **Auth** :
   - Copier **Client ID** et **Client Secret** dans `.env` (`LINKEDIN_CLIENT_ID/SECRET`)
   - Ajouter l'URL de redirection : `http://localhost:3000/api/linkedin/callback`

## 4. App LinkedIn n°2 — pages entreprise (optionnel)

La **Community Management API** est incompatible avec les produits de l'app n°1 → app dédiée obligatoire :

1. Créer une **2e app**, sans aucun autre produit, associée à la page entreprise et **vérifiée**
2. Demander le produit **Community Management API** (formulaire, validation LinkedIn)
3. Une fois approuvé : Client ID/Secret dans `.env` (`LINKEDIN_ORG_CLIENT_ID/SECRET`) et URL de redirection `http://localhost:3000/api/linkedin/callback-org`
4. Dans l'app : bouton « + Connecter la page », puis choisir la page dans « Publier en tant que »

## 5. Lancer

```bash
npm run dev
```

Ouvrir http://localhost:3000 → créer un compte client → **Connecter LinkedIn** → générer → brouillon → **Publier**.

## Architecture

```
prisma/schema.prisma               Modèles User, LinkedInAccount, Draft
lib/db.js                          Client Prisma (singleton)
lib/session.js                     Sessions JWT (cookie httpOnly)
app/
  page.js                          UI (auth + génération + brouillons)
  api/auth/{register,login,logout,me}  Comptes clients (bcrypt + JWT)
  api/drafts/...                   CRUD brouillons (par client)
  api/generate/route.js            Génération via API Claude
  api/linkedin/auth, callback      OAuth app 1 (profil perso)
  api/linkedin/auth-org, callback-org  OAuth app 2 (pages entreprise)
  api/linkedin/organizations       Pages administrées (organizationAcls)
  api/linkedin/me, logout          Statut / déconnexion LinkedIn
  api/linkedin/publish/route.js    Publication POST /rest/posts
```

## Comptes clients & données

- Auth maison : bcrypt + sessions JWT (cookie httpOnly signé avec `AUTH_SECRET`)
- Chaque client a ses propres tokens LinkedIn et brouillons (isolation par `userId` dans toutes les requêtes)
- SQLite en dev ; pour la prod : `DATABASE_URL` Postgres + `provider = "postgresql"` dans le schéma

## Limites actuelles (et prochaines étapes)

- **Programmation** : le bouton « Programmer » change le statut mais aucun cron n'envoie le post à l'heure dite (à brancher : Vercel Cron + champ `scheduledAt`).
- **Carrousel / vidéo** : le texte est publié ; l'upload du document PDF (carrousel) ou de la vidéo nécessite l'API Images/Videos de LinkedIn.
- **Tokens** : les tokens LinkedIn expirent après ~60 jours ; prévoir le refresh ou la reconnexion.
- **Chiffrement** : les tokens LinkedIn sont stockés en clair en base — à chiffrer (AES) avant une vraie mise en production.
- **Rate limits LinkedIn** : ~100 appels/jour/membre sur l'API de publication.

## Déploiement en production (Hetzner + Neon + Docker)

Prérequis sur le serveur : Docker + Docker Compose, un domaine pointant vers l'IP du serveur (enregistrement A).

1. **Base** : sur Neon, utiliser la branche principale pour la prod. Lancer une fois depuis votre machine :
   `DATABASE_URL="<url neon prod>" npx prisma db push`
2. **LinkedIn** : dans les deux apps LinkedIn (onglet Auth), ajouter les redirect URIs de prod :
   `https://postgenius.votredomaine.fr/api/linkedin/callback` et `.../callback-org`
3. **Serveur** :
   ```bash
   git clone <votre-repo> && cd postgenius
   cp .env.example .env   # remplir avec les valeurs de PROD
   # APP_URL=https://postgenius.votredomaine.fr, redirect URIs de prod,
   # AUTH_SECRET et TOKEN_ENCRYPTION_KEY générés (openssl rand -hex 32), SMTP réel
   nano Caddyfile          # remplacer par votre domaine
   docker compose up -d --build
   ```
   Caddy obtient le certificat HTTPS automatiquement. L'app tourne en continu :
   le planificateur intégré publie les posts programmés chaque minute.
4. **Mises à jour** : `git pull && docker compose up -d --build`
5. **Sauvegardes** : Neon gère les snapshots ; vérifier la rétention dans votre plan.

Sécurité incluse : tokens LinkedIn chiffrés (AES-256-GCM), mots de passe bcrypt,
sessions JWT httpOnly + secure, rate limiting sur l'authentification, headers de
sécurité, AUTH_SECRET/TOKEN_ENCRYPTION_KEY obligatoires en production.

⚠️ Si vous changez `TOKEN_ENCRYPTION_KEY`, les connexions LinkedIn existantes
deviennent illisibles : les clients devront reconnecter leurs comptes.

## Notes techniques LinkedIn

- Endpoint : `POST https://api.linkedin.com/rest/posts` avec headers `LinkedIn-Version: YYYYMM` et `X-Restli-Protocol-Version: 2.0.0` (l'ancien `/v2/ugcPosts` est déprécié)
- Les caractères spéciaux `(){}[]<>@|#*_~\` sont échappés dans `commentary` (exigence du format LinkedIn)
- L'ID du post créé est renvoyé dans le header `x-restli-id`
- Erreur 422 = contenu dupliqué (texte identique à un post récent) ou champ invalide
