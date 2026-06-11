# Bascule en production — postgenius.network (Hetzner)

Runbook complet. Temps estimé : ~45 min (hors propagation DNS).

## 0. Prérequis
- Domaine **postgenius.network** acheté, accès à la zone DNS
- Serveur Hetzner (Ubuntu/Debian) accessible en SSH, IP notée ci-après `IP_SERVEUR`
- Le projet fonctionne en local

## 1. DNS (à faire en premier — propagation 5 min à quelques heures)
Dans la zone DNS du domaine :
```
A    postgenius.network        → IP_SERVEUR
A    www.postgenius.network    → IP_SERVEUR
```

## 2. LinkedIn — redirect URIs de production
Sur https://www.linkedin.com/developers/apps, app principale → onglet **Auth** → ajouter :
```
https://postgenius.network/api/linkedin/callback
```
(garder aussi l'URL localhost pour continuer à développer).
Quand la 2e app (Community Management) sera active, y ajouter de même :
```
https://postgenius.network/api/linkedin/callback-org
```

## 3. Préparer le serveur (une seule fois)
```bash
ssh root@IP_SERVEUR
apt update && apt install -y docker.io docker-compose-v2 git
systemctl enable --now docker
mkdir -p /opt/postgenius && cd /opt/postgenius
```

## 4. Transférer le code
**Option A — dépôt git (recommandé)** : créer un dépôt privé GitHub, puis en local :
```bash
cd ~/linkedin
git init && git add -A && git commit -m "Production v1"
git remote add origin git@github.com:VOTRE_COMPTE/postgenius.git
git push -u origin main
```
puis sur le serveur : `git clone git@github.com:VOTRE_COMPTE/postgenius.git /opt/postgenius`
(ajouter une clé de déploiement GitHub si dépôt privé).

**Option B — copie directe** depuis le Mac :
```bash
rsync -av --exclude node_modules --exclude .next --exclude data --exclude .env \
  ~/linkedin/ root@IP_SERVEUR:/opt/postgenius/
```

## 5. Le .env de production (sur le serveur)
```bash
cd /opt/postgenius && nano .env
```
Partir du .env local en changeant UNIQUEMENT ces lignes :
```
APP_URL=https://postgenius.network
LINKEDIN_REDIRECT_URI=https://postgenius.network/api/linkedin/callback
LINKEDIN_ORG_REDIRECT_URI=https://postgenius.network/api/linkedin/callback-org
```
⚠️ GARDER les mêmes `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` et `DATABASE_URL`
qu'en local : la base Neon actuelle devient la base de PRODUCTION (vos comptes
et connexions LinkedIn sont conservés). PHYLLO_ENV reste `staging` pour l'instant.

## 6. Lancer
```bash
cd /opt/postgenius
docker compose up -d --build        # build ~3-5 min
docker compose logs -f app          # vérifier : "scheduler ... démarré", pas d'erreur
```
Caddy obtient le certificat HTTPS automatiquement dès que le DNS pointe.

## 7. Vérifications de mise en service
1. https://postgenius.network s'ouvre en HTTPS → écran de connexion
2. Connexion avec votre compte → l'entrée Administration est visible
3. Profil → Connecter LinkedIn → OAuth OK (sinon : vérifier l'URI ajoutée à l'étape 2)
4. Générer un post → publier → vérifier sur LinkedIn
5. Programmer un post à +3 min → vérifier la publication automatique
   (`docker compose logs -f app` doit montrer `[scheduler] Post ... publié`)
6. Générer une image → vérifier qu'elle s'affiche (volume ./data monté)

## 8. Après la bascule
- **Base de dev** : sur https://console.neon.tech, créer une branche `development`
  du projet et mettre sa connection string dans le `DATABASE_URL` du `.env`
  LOCAL — le dev n'écrit plus jamais en prod.
- **SMTP** (mot de passe oublié) : créer un compte https://www.brevo.com (300
  emails/jour gratuits) → SMTP & API → remplir `SMTP_HOST=smtp-relay.brevo.com`,
  `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` dans le .env serveur,
  puis `docker compose up -d`.
- **Mises à jour** : `git pull && docker compose up -d --build`
  (ou re-rsync puis rebuild).
- **Sauvegardes** : Neon gère les snapshots ; le dossier `/opt/postgenius/data`
  (images) à sauvegarder via les snapshots Hetzner.

## Dépannage rapide
- Certificat HTTPS absent → DNS pas encore propagé (`dig postgenius.network`)
- OAuth LinkedIn "Bummer" → redirect URI manquante ou différente dans l'app LinkedIn
- 502 → `docker compose logs app` (souvent variable .env manquante)
