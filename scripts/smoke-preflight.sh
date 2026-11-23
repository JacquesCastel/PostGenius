#!/usr/bin/env bash
#
# Avant un déploiement : le site de production répond-il ? Le contrôle après déploiement (scripts/smoke.sh) interroge cette même adresse ;
# s'il ne peut pas la joindre, il ne peut rien confirmer. On le sait AVANT de toucher à quoi que ce soit, et on s'arrête avec un message clair.
# Usage : scripts/smoke-preflight.sh [adresse]   (défaut : $SMOKE_URL, sinon https://postgenius.network)
# Code de sortie : 0 si le site répond (HTTP 200 sur /api/health), 1 sinon.
# Une seule dépendance : curl.
#
URL="${1:-${SMOKE_URL:-https://postgenius.network}}"
URL="${URL%/}"
code=$(curl -sk --max-time 10 -o /dev/null -w '%{http_code}' "$URL/api/health" 2>/dev/null || true)
if [ "$code" = "200" ]; then
  echo "    ✓ $URL répond : le contrôle après déploiement pourra confirmer la mise en ligne."
  exit 0
fi
echo "    ✗ ce serveur ne joint pas $URL (code ${code:-000})." >&2
echo "      Le contrôle après déploiement ne pourrait rien confirmer : le déploiement est ARRÊTÉ avant tout changement." >&2
echo "      • adresse différente : SMOKE_URL=https://… ./deploy.sh   (ou SMOKE_URL dans le .env)" >&2
echo "      • site réellement en panne et vous voulez déployer quand même : SKIP_SMOKE=1 ./deploy.sh   (vous contrôlez alors à la main)" >&2
exit 1
