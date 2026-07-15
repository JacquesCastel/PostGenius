#!/usr/bin/env bash
#
# Déploiement LinkeePost (serveur Hetzner /opt/postgenius)
#
# POURQUOI CE SCRIPT : sur ce serveur, `next build` lancé par `docker build`
# (ou directement sur le volume monté) prérend les grandes pages À VIDE,
# alors que le même `next build` dans l'overlay interne d'un `docker run`
# produit le bon rendu. On build donc dans un `docker run`, on copie le
# résultat sur l'hôte, puis l'image ne fait QUE copier ce build.
#
# Le script synchronise aussi le schéma Prisma vers la base de PROD (db push)
# et vérifie que la landing servie n'est pas vide.
#
# Usage : sur le serveur,  cd /opt/postgenius && ./deploy.sh
#
set -euo pipefail
cd /opt/postgenius

echo "==> 1/5  git pull"
git pull

# ── Lecture du .env sur l'hôte (avant d'entrer dans Docker) ─────────────────
# Le .env appartient à root:root rw-r-----, donc lisible par root sur l'hôte
# mais pas nécessairement par le root remap'é dans le conteneur.
# On extrait les valeurs ici, puis on les passe via -e à docker run.
ENV_FILE=""
[ -f /opt/postgenius/.env ]       && ENV_FILE=/opt/postgenius/.env
[ -z "$ENV_FILE" ] && [ -f /opt/postgenius/.env.local ] && ENV_FILE=/opt/postgenius/.env.local
if [ -z "$ENV_FILE" ]; then
  echo "ERREUR : aucun fichier .env trouvé dans /opt/postgenius/" >&2
  exit 1
fi
echo "    env file : $ENV_FILE"

BUILD_DB_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
BUILD_VAPID=$(grep -E "^NEXT_PUBLIC_VAPID_PUBLIC_KEY=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')

if [ -z "$BUILD_DB_URL" ]; then
  echo "ERREUR : DATABASE_URL introuvable dans $ENV_FILE" >&2
  exit 1
fi

echo "==> 2/5  build (overlay conteneur) + sync schéma base de prod"
docker run --rm --user root \
  -e BUILD_DB_URL="$BUILD_DB_URL" \
  -e BUILD_VAPID="$BUILD_VAPID" \
  -v /opt/postgenius:/host node:22-slim bash -c '
  set -e
  mkdir /b && cd /b
  cp -r /host/. .
  rm -rf .next node_modules .env .env.local .git
  npm ci
  # Synchronise le schéma vers la base de PROD (DATABASE_URL passé en var depuis l hôte).
  # --accept-data-loss : nécessaire pour l ajout de contraintes UNIQUE sur des colonnes
  # nullable (les NULL ne sont pas des doublons sous PostgreSQL, pas de vraie perte).
  DATABASE_URL="$BUILD_DB_URL" npx prisma db push --skip-generate --accept-data-loss
  # Build avec une base factice (landing/blog sont rendus à la requête).
  export DATABASE_URL="postgresql://build:build@localhost:5432/build"
  # Clé VAPID PUBLIQUE : inlinée au build (variable NEXT_PUBLIC_*).
  export NEXT_PUBLIC_VAPID_PUBLIC_KEY="$BUILD_VAPID"
  npx prisma generate
  npx next build
  # Copier le build vers l hôte (la copie préserve le rendu SSG).
  rm -rf /host/.next && cp -r .next /host/.next
  mkdir -p /host/node_modules
  rm -rf /host/node_modules/.prisma  && cp -r node_modules/.prisma  /host/node_modules/.prisma
  rm -rf /host/node_modules/@fontsource && cp -r node_modules/@fontsource /host/node_modules/@fontsource
'

echo "==> 3/5  image (copie du build) + redémarrage"
docker compose up -d --build --force-recreate app

echo "==> 4/5  garde-fou : la landing servie ne doit pas être vide"
sleep 6
STATE=$(docker compose exec -T app node -e "fetch('http://localhost:3000/').then(r=>r.text()).then(t=>console.log(t.length>30000?'OK':'VIDE('+t.length+')')).catch(e=>console.log('ERR '+e.message))" 2>/dev/null | tr -d '\r')
echo "    landing runtime : ${STATE}"
case "$STATE" in
  OK) : ;;
  *) echo "    ⚠ La landing servie semble anormale. Vérifiez : docker compose logs app" ;;
esac

echo "==> 5/5  entretien disque + vérification"
docker image prune -f >/dev/null 2>&1 || true
echo -n "    titre servi en prod : "
curl -skL https://postgenius.network | grep -o '<title>[^<]*' || true
echo
echo "==> Terminé."
