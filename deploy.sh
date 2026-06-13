#!/usr/bin/env bash
#
# Déploiement PostGenius (serveur Hetzner /opt/postgenius)
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

echo "==> 2/5  build (overlay conteneur) + sync schéma base de prod"
docker run --rm -v /opt/postgenius:/host node:22-slim bash -c '
  set -e
  mkdir /b && cd /b
  cp -r /host/. .
  rm -rf .next node_modules .env .env.local .git
  npm ci
  # Synchronise le schéma vers la base de PROD (DATABASE_URL réel depuis .env).
  # Sans --accept-data-loss : refuse toute opération destructrice.
  DBURL=$(grep -E "^DATABASE_URL=" /host/.env | head -1 | cut -d= -f2- | tr -d "\"")
  DATABASE_URL="$DBURL" npx prisma db push --skip-generate
  # Build avec une base factice (landing/blog sont rendus à la requête).
  export DATABASE_URL="postgresql://build:build@localhost:5432/build"
  npx prisma generate
  npx next build
  # Copier le build vers l hôte (la copie préserve le rendu).
  rm -rf /host/.next && cp -r .next /host/.next
  mkdir -p /host/node_modules && rm -rf /host/node_modules/.prisma && cp -r node_modules/.prisma /host/node_modules/.prisma
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
