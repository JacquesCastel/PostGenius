# Bascule en production — postgenius.network (Hetzner)

Runbook complet. Temps estimé : ~45 min (hors propagation DNS).

## 0. Prérequis
- Domaine **postgenius.network** acheté, accès à la zone DNS
- Serveur Hetzner (Ubuntu/Debian) accessible en SSH, IP notée ci-après `IP_SERVEUR`
  - **IP du serveur : `46.225.15.150`** → `ssh root@46.225.15.150`
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
et connexions LinkedIn sont conservés).

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
- **SMTP** (mot de passe oublié, invitations d'équipe, liens de validation client,
  notifications à l'agence) : créer un compte https://www.brevo.com (300
  emails/jour gratuits) → SMTP & API → remplir `SMTP_HOST=smtp-relay.brevo.com`,
  `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` dans le .env serveur,
  puis `docker compose up -d`.
- **Mises à jour** (commande de référence) :
  ```bash
  cd /opt/postgenius && ./deploy.sh
  ```
  Voir la section 12 : garde-fous du déploiement (retour arrière, copie de la base, contrôle automatique).
  ⚠️ NE PAS faire `docker compose up -d --build` seul : sur ce serveur,
  `next build` exécuté par `docker build` (ou directement sur le volume monté)
  prérend la page d'accueil À VIDE (~5,9 Ko au lieu de ~71 Ko ; la page bascule
  en rendu client). Le `deploy.sh` contourne le bug en buildant dans l'overlay
  interne d'un `docker run`, puis l'image ne fait que copier le build. Le script
  inclut un garde-fou qui annule le déploiement si la landing ressort vide.
- **Vérifier qu'un déploiement a pris effet** :
  ```bash
  curl -s https://postgenius.network | grep -o '<title>[^<]*'
  ```
- **Sauvegardes** : la base est sauvegardée par Neon (snapshots). Le dossier
  `/opt/postgenius/data` (images, logos, fonds, médiathèque) est sauvegardé par
  `backup-data.sh` : archive `tar.gz` datée dans `/opt/postgenius-backups`
  (hors dépôt), 14 dernières conservées. Installation (une fois) :
  ```bash
  crontab -e   # ajouter :
  30 3 * * * /opt/postgenius/backup-data.sh >> /var/log/postgenius-backup.log 2>&1
  ```
  **Copie hors serveur (Hetzner Storage Box)** : sans elle, une perte du serveur
  emporte aussi les archives. Mise en place (une fois) :
  1. Console Hetzner : commander une Storage Box (BX11 suffit), noter son
     identifiant `uXXXXXX`, et y activer « SSH support » et « External reachability ».
  2. Sur le serveur : clé dédiée, puis installation sur la Storage Box
     (le mot de passe de la box est demandé une seule fois) :
     ```bash
     ssh-keygen -t ed25519 -N "" -f /root/.ssh/postgenius_backup
     cat /root/.ssh/postgenius_backup.pub | ssh -p 23 uXXXXXX@uXXXXXX.your-storagebox.de install-ssh-key
     ```
  3. Réglages, hors dépôt :
     ```bash
     echo 'BACKUP_RSYNC_TARGET=uXXXXXX@uXXXXXX.your-storagebox.de:postgenius-backups/' > /opt/postgenius/backup.env
     chmod 600 /opt/postgenius/backup.env
     ```
  4. Vérifier : `/opt/postgenius/backup-data.sh --test-remote` puis une sauvegarde
     complète `/opt/postgenius/backup-data.sh` (doit finir par « copie hors serveur OK »).
  Le script reflète ensuite `/opt/postgenius-backups` vers la box à chaque passage
  (`rsync --delete`) : la copie distante a les mêmes 14 archives. Si seule la copie
  distante échoue, le script sort avec le code 2 et la sauvegarde locale reste valide
  (voir `/var/log/postgenius-backup.log`).
  Restauration :
  ```bash
  ls /opt/postgenius-backups                       # choisir l'archive
  cd /opt/postgenius && tar -xzf /opt/postgenius-backups/data-AAAAMMJJ-HHMMSS.tar.gz
  chmod 777 data/images data/logos data/backgrounds data/videos
  ```
  Après la perte complète du serveur : réinstaller, puis récupérer les archives
  depuis la Storage Box (`rsync -a -e "ssh -p 23" uXXXXXX@uXXXXXX.your-storagebox.de:postgenius-backups/ /opt/postgenius-backups/`)
  avant de restaurer comme ci-dessus.

## Dépannage rapide
- Certificat HTTPS absent → DNS pas encore propagé (`dig postgenius.network`)
- OAuth LinkedIn "Bummer" → redirect URI manquante ou différente dans l'app LinkedIn
- 502 → `docker compose logs app` (souvent variable .env manquante)
- **Le site sert une ancienne version malgré les rebuilds** (vécu !) :
  1. S'assurer que buildx est installé : `apt install -y docker-buildx`
     (le builder « legacy » a un cache fantôme que `builder prune` ne purge pas)
  2. `docker compose up -d --build --force-recreate app`
  3. Si ça persiste, stockage du démon corrompu → réinitialisation totale
     (sans risque : .env, data/ et la base Neon sont hors de Docker) :
     ```bash
     docker compose down
     systemctl stop docker docker.socket
     rm -rf /var/lib/docker
     systemctl start docker
     docker compose up -d --build
     ```
  4. Test discriminant si doute sur la source : build hors pipeline Docker
     ```bash
     docker run --rm -v /opt/postgenius:/src -w /src node:22-alpine \
       sh -c "npm ci >/dev/null 2>&1 && npx prisma generate >/dev/null 2>&1 && rm -rf .next && DATABASE_URL=postgresql://x:x@localhost/x npx next build >/dev/null 2>&1; grep -c 'Essai gratuit' .next/server/app/index.html"
     ```

## 9. Vérifier une mise en production (parcours agence)
Le serveur écrit `[config] …` au démarrage si `SMTP_HOST` ou `APP_URL` manque
(`docker compose logs app | grep "\[config\]"`). Ensuite, dans l'application :
1. **Client** : « Mes clients » → créer un client → compléter son profil → connecter sa page LinkedIn.
2. **Validation client** : icône chaîne du client → créer le lien → l'envoyer à une adresse de test →
   ouvrir le lien dans une fenêtre privée → valider un post et en refuser un avec commentaire →
   vérifier que la demande apparaît dans « À traiter ».
3. **Rapport** : icône graphique du client → « Partager au client » → ouvrir le lien en fenêtre privée.
4. **Publication** : un post avec une mention, un sondage, et un carrousel en PDF (nécessite les images
   générées) sur la page du client ; contrôler le rendu sur LinkedIn.
5. **Commentaires** : « Mes posts » → Commentaires → « Proposer une réponse » (lecture sous réserve de
   l'accès LinkedIn aux commentaires de la page).
Les migrations de ce développement sont additives (`prisma db push` ne supprime rien) : tables
`ApprovalLink`, `ReportLink`, `Snippet`, colonnes `Draft.clientFeedback`, `clientFeedbackAt`, `clientApprovedAt`,
`poll`, `documentSlides`.

## 10. Quotas et e-mails d'accompagnement
- **Quotas** : limites par offre modifiables dans Administration → « Limites des offres » (posts, images, sources ; -1 = illimité ;
  vide = valeur d'origine de `lib/plans.js`). Réglage par compte : bouton « Quotas » sur la ligne du compte. Réglage par client d'agence :
  bouton jauge sur la ligne du client (propriétaire de l'agence). Les prix et les fonctions incluses restent dans le code (liés à Stripe).
- **E-mails** (nécessitent `SMTP_HOST`, une passe par heure) : alertes de quota à 80 % puis 100 % (e-mail de service) ; accueil aux jours 1, 3
  et 7 ; récapitulatif le lundi dès 8 h (avec lien de désinscription) ; pour l'agence, relances de validation (tous les 3 jours, 3 fois) et
  rapport du mois le 1er, **uniquement** pour les clients où l'agence a coché l'option dans « Lien de validation ».
- **Lancer un envoi tout de suite** (administrateur) : `POST /api/admin/emails/run` avec `{"job":"quota|onboarding|digest|reminders|reports"}`.
  Chaque message reste unique : un envoi déjà fait n'est jamais répété.
- Migration additive : tables `PlanConfig`, colonnes `User.quotaOverrides`, `User.emailOptOut`, et réglages d'envoi sur `ApprovalLink`.


## 11. Mesure d'audience (Umami, sans cookie)

Le site public peut mesurer ses visites avec **Umami** : aucun cookie, aucune donnée personnelle, donc **pas de bandeau de consentement**.
Le script n'est chargé que sur les pages publiques (jamais dans `/app`, `/valider`, `/rapport`, `/reset-password`) et respecte « Do Not Track ».
Sans les deux variables `UMAMI_*` du `.env`, rien n'est chargé.

**Option A : Umami Cloud** (le plus simple, aucun serveur à gérer)
1. Créer un compte sur https://cloud.umami.is, puis ajouter le site `postgenius.network`.
2. Dans `.env` : `UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js` et `UMAMI_WEBSITE_ID=` (l'identifiant du site, un UUID).
3. `./deploy.sh`.

**Option B : auto-hébergé** (les données restent chez vous)
1. Créer un enregistrement DNS `stats.postgenius.network` vers le serveur (même adresse que `postgenius.network`).
2. Dans `.env` : `COMPOSE_PROFILES=stats`, `UMAMI_DB_PASSWORD=` (mot de passe long), `UMAMI_APP_SECRET=` (`openssl rand -hex 32`).
3. Ajouter dans le `Caddyfile` :
   ```
   stats.postgenius.network {
   	reverse_proxy umami:3000
   }
   ```
4. `./deploy.sh`, puis ouvrir `https://stats.postgenius.network` (identifiants initiaux `admin` / `umami` : **à changer immédiatement**).
5. Ajouter le site `postgenius.network`, puis dans `.env` : `UMAMI_SCRIPT_URL=https://stats.postgenius.network/script.js` et `UMAMI_WEBSITE_ID=` (l'UUID du site). `./deploy.sh`.

Vérifier : ouvrir le site en navigation privée, puis voir la visite apparaître dans Umami (« Temps réel »). Les visites de `/app` n'y figurent pas.
La politique de confidentialité (anglais dans le code, français dans l'Administration) mentionne cette mesure.

## 12. Déployer sans risque : garde-fous de `./deploy.sh`

`./deploy.sh` fait maintenant sept choses, dans cet ordre, pour qu'un échec ne laisse rien de cassé :

1. `git pull`, et rappel de la version en ligne (`cat .deployed-sha`) et de celle à mettre en ligne ;
2. **vérification du moment** : avertit (et demande confirmation) si un post doit partir dans les 15 minutes ou en retard, ou si une
   transcription vidéo est en cours. Un redémarrage peut les retarder ou les perdre. `FORCE=1 ./deploy.sh` passe outre ;
3. **copie de la base Neon** si le schéma Prisma a changé depuis la version en ligne (branche `avant-deploy-AAAAMMJJ-HHMM`) ;
4. **build dans un conteneur** (`scripts/build-in-container.sh`) : contrôle du schéma, build, et **seulement si le build réussit**, changement de
   schéma de la base ;
5. **mise en place** : l'ancien build est gardé dans `.prev/` ;
6. redémarrage ;
7. **contrôle automatique** (`scripts/smoke.sh`) : santé et base, page d'accueil non vide, pages publiques, métadonnées OAuth, et connexion réelle
   si un compte de contrôle est défini. **S'il échoue, retour arrière automatique** à la version précédente.

### Changement de schéma destructif

Le contrôle du schéma classe la différence avec la base en AUCUN, AJOUT (rien n'est perdu) ou DESTRUCTIF (suppression de table ou de colonne,
changement de type). Un changement destructif **est refusé** (le build n'est même pas lancé) et la différence est écrite dans `.schema-diff.sql`.
Après l'avoir lue, et si c'est voulu : `ALLOW_DATA_LOSS=1 ./deploy.sh`.

### Retour arrière manuel

```bash
cd /opt/postgenius && ./rollback.sh
```
Remet en ligne la version d'avant le dernier déploiement en une minute, sans refaire de build, puis la contrôle. **La base n'est pas rétablie** : les
changements de schéma sont des ajouts, l'ancienne version fonctionne avec. Le code du dépôt reste à la dernière version : avant de redéployer,
corrigez le problème ou annulez la fusion sur GitHub (« Revert »), sinon le prochain déploiement remettra en ligne la version retirée.
Un seul retour arrière est possible (la version précédente est gardée une seule fois).

### Réglages à ajouter dans `/opt/postgenius/.env` (facultatifs, recommandés)

| Réglage | Rôle |
|---|---|
| `NEON_API_KEY`, `NEON_PROJECT_ID` | Copie de la base avant chaque changement de schéma. Clé : console.neon.tech → Account settings → API keys. Identifiant du projet : Settings du projet. |
| `NEON_KEEP_BRANCHES=5` | Garde les 5 dernières copies `avant-deploy-…` et supprime les plus anciennes (jamais une autre branche). |
| `SMOKE_EMAIL`, `SMOKE_PASSWORD` | Compte de contrôle : un compte ordinaire (jamais administrateur), pour tester la vraie connexion après chaque déploiement. |
| `SMOKE_URL` | Adresse contrôlée (par défaut `https://postgenius.network`). À changer si le serveur ne peut pas joindre sa propre adresse publique : sinon le contrôle automatique est désactivé avec un avertissement. |

Sans réglage Neon, le déploiement fonctionne mais affiche « SANS-SNAPSHOT » quand le schéma change : le seul filet est alors la sauvegarde
automatique de Neon.

### Surveillance extérieure (à créer une fois, gratuit)

Sur https://uptimerobot.com (ou équivalent) : un moniteur « mot-clé » sur `https://postgenius.network/api/health`, qui cherche `"ok":true`, toutes les
5 minutes, avec alerte par e-mail (et notification sur téléphone). `/api/health` répond 200 si l'application tourne ET joint la base, 503 sinon.
Un second moniteur sur la page d'accueil. C'est ce qui vous prévient si le serveur lui-même s'arrête.

### À savoir

- **Quand déployer :** hors des créneaux de publication (les posts partent typiquement entre 7 h et 9 h UTC) et pas avec des transcriptions en cours.
- **Journal :** `deploys.log` (début, copie de la base, résultat, retours arrière).
- **Disque :** `.prev/` et `.rolledback/` occupent chacun à peu près la taille de `.next`. L'alerte d'espace disque de l'administration les inclut.
- **Si `deploy.sh` lui-même a un défaut :** `./deploy.legacy.sh` (ancienne version : même résultat, sans les garde-fous).
- **Banc d'essai :** `bash tests/deploy/run.sh` rejoue le déroulé complet, pannes comprises, avec des doubles de `docker` et `git`. À relancer après toute
  modification de `deploy.sh`, `rollback.sh` ou des scripts de `scripts/`.
- **Premier déploiement avec ce script :** à faire à un moment calme, en gardant la sortie sous les yeux.
