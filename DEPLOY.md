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
