#!/usr/bin/env bash
#
# Déploiement PostGenius (serveur Hetzner /opt/postgenius)
#
# POURQUOI CE SCRIPT : sur ce serveur, `next build` lancé par `docker build`
# (ou directement sur le volume monté) prérend la grande page d'accueil À VIDE
# (~5,9 Ko au lieu de ~71 Ko : la page bascule en rendu client). Le même
# `next build` lancé DANS l'overlay interne d'un conteneur `docker run` produit
# la bonne page. On build donc dans un `docker run`, on copie le résultat sur
# l'hôte, puis l'image ne fait QUE copier ce build (la copie, elle, est fiable).
#
# Usage : sur le serveur,  cd /opt/postgenius && ./deploy.sh
#
set -euo pipefail
cd /opt/postgenius

echo "==> 1/5  git pull"
git pull

echo "==> 2/5  build dans l'overlay du conteneur (PAS sur le volume)"
docker run --rm -v /opt/postgenius:/host node:22-slim bash -c '
  set -e
  mkdir /b && cd /b
  cp -r /host/. .
  rm -rf .next node_modules .env .env.local .git
  npm ci
  export DATABASE_URL="postgresql://build:build@localhost:5432/build"
  npx prisma generate
  npx next build
  # copier le build vers l hôte (la copie préserve le rendu)
  rm -rf /host/.next && cp -r .next /host/.next
  mkdir -p /host/node_modules && rm -rf /host/node_modules/.prisma && cp -r node_modules/.prisma /host/node_modules/.prisma
'

echo "==> 3/5  garde-fou : la landing ne doit pas être vide"
SIZE=$(wc -c < .next/standalone/.next/server/app/index.html)
echo "    landing standalone : ${SIZE} octets"
if [ "$SIZE" -lt 20000 ]; then
  echo "    ERREUR : landing prérendue à vide (${SIZE} octets). Déploiement annulé."
  exit 1
fi

echo "==> 4/5  image (copie du build) + redémarrage"
docker compose up -d --build --force-recreate app

echo "==> 5/5  entretien disque + vérification"
docker image prune -f >/dev/null 2>&1 || true
sleep 5
echo -n "    titre servi en prod : "
curl -skL https://postgenius.network | grep -o '<title>[^<]*' || true
echo
echo "==> Terminé."
