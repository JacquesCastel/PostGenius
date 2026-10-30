#!/usr/bin/env bash
#
# Retour arrière LinkeePost : remet en ligne la version d'avant le dernier déploiement (gardée dans .prev/ par deploy.sh), en une minute,
# sans refaire de build. Usage : cd /opt/postgenius && ./rollback.sh
# Attention : la base de données n'est PAS rétablie (les changements de schéma sont des ajouts : l'ancienne version fonctionne avec).
# Après un retour arrière, le code du dépôt reste à la dernière version : avant de redéployer, corrigez le problème ou annulez la
# fusion sur GitHub (« Revert »), sinon le prochain ./deploy.sh remettra en ligne la version retirée.
#
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/postgenius}"
cd "$APP_DIR"
LOG="$APP_DIR/deploys.log"
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
SMOKE="${SMOKE_SCRIPT:-$APP_DIR/scripts/smoke.sh}"

if [ ! -d "$APP_DIR/.prev/next" ]; then
  echo "ERREUR : aucune version précédente conservée (.prev/next absent). Retour arrière impossible." >&2
  exit 1
fi
PREV_SHA=$(cat "$APP_DIR/.prev/sha" 2>/dev/null || echo inconnu)
CUR_SHA=$(cat "$APP_DIR/.deployed-sha" 2>/dev/null || echo inconnu)
echo "==> Retour arrière : $CUR_SHA  →  $PREV_SHA"
log "retour arrière $CUR_SHA -> $PREV_SHA"

# La version retirée est gardée un temps dans .rolledback/ pour analyse
rm -rf "$APP_DIR/.rolledback"
mkdir -p "$APP_DIR/.rolledback"
[ -d "$APP_DIR/.next" ] && mv "$APP_DIR/.next" "$APP_DIR/.rolledback/next"
mv "$APP_DIR/.prev/next" "$APP_DIR/.next"
if [ -d "$APP_DIR/.prev/prisma-client" ]; then
  rm -rf "$APP_DIR/node_modules/.prisma"
  mv "$APP_DIR/.prev/prisma-client" "$APP_DIR/node_modules/.prisma"
fi

docker compose up -d --build --force-recreate app
if "$SMOKE"; then
  echo "$PREV_SHA" > "$APP_DIR/.deployed-sha"
  rm -rf "$APP_DIR/.prev"
  log "retour arrière réussi : $PREV_SHA en ligne"
  echo "==> Terminé : $PREV_SHA est en ligne."
else
  log "retour arrière : le contrôle a échoué aussi"
  echo "==> ⚠ Le contrôle échoue aussi après le retour arrière : regardez docker compose logs app" >&2
  exit 1
fi
