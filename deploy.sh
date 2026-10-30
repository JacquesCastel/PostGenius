#!/usr/bin/env bash
#
# Déploiement LinkeePost (serveur Hetzner /opt/postgenius)
#
# Usage : sur le serveur,  cd /opt/postgenius && ./deploy.sh
#   FORCE=1            ne demande pas confirmation s'une publication est proche ou une transcription en cours
#   ALLOW_DATA_LOSS=1  autorise un changement de schéma qui supprime ou transforme des données (à n'utiliser qu'après avoir lu .schema-diff.sql)
#   SMOKE_URL=…        adresse contrôlée après déploiement (défaut : https://postgenius.network)
#   SKIP_SMOKE=1       désactive le contrôle automatique et le retour arrière automatique (à éviter)
# Retour arrière : ./rollback.sh   (la version précédente est conservée dans .prev/). Journal : deploys.log
# En cas de défaut de ce script lui-même : ./deploy.legacy.sh (ancienne version).
#
# Ordre voulu, pour qu'un échec ne laisse rien de cassé :
#   1. moment : avertit si un post doit partir dans les 15 minutes ou si une transcription vidéo est en cours ;
#   2. copie de la base Neon (si le schéma change et si NEON_API_KEY / NEON_PROJECT_ID sont définis) ;
#   3. build dans un conteneur (scripts/build-in-container.sh) : contrôle du schéma, build, PUIS changement de schéma ;
#   4. mise en place : l'ancien build est gardé dans .prev/ avant d'être remplacé ;
#   5. redémarrage ;
#   6. contrôle automatique (scripts/smoke.sh) : en cas d'échec, retour arrière automatique.
#
# POURQUOI UN BUILD DANS `docker run` : sur ce serveur, `next build` lancé par `docker build` (ou directement sur le volume monté)
# prérend les grandes pages À VIDE, alors que le même build dans l'overlay interne d'un `docker run` donne le bon rendu. L'image finale
# ne fait que COPIER ce build.
#
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/postgenius}"
cd "$APP_DIR"
LOG="$APP_DIR/deploys.log"
# Journal lisible par l'application (tableau de bord technique) : une ligne JSON par événement, dans le volume de données partagé
JLOG="$APP_DIR/data/state/deploys.jsonl"
jlog() { # jlog <événement> <sha> <précédent> [détail]
  mkdir -p "$APP_DIR/data/state" 2>/dev/null || return 0
  printf '{"at":"%s","event":"%s","sha":"%s","prev":"%s","detail":"%s"}\n' "$(date -u '+%FT%TZ')" "$1" "${2:-}" "${3:-}" "$(printf '%s' "${4:-}" | tr -d '"\\' | tr '\n' ' ' | cut -c1-200)" >> "$JLOG" 2>/dev/null || true
}
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
SMOKE="${SMOKE_SCRIPT:-$APP_DIR/scripts/smoke.sh}"
# Version en ligne, lisible par l'application
write_version() { printf '{"sha":"%s","prev":"%s","at":"%s"}\n' "$NEW_SHA" "$PREV_SHA" "$(date -u '+%FT%TZ')" > "$APP_DIR/data/state/version.json" 2>/dev/null || true; }
SNAPSHOT="${SNAPSHOT_SCRIPT:-$APP_DIR/scripts/neon-snapshot.sh}"

echo "==> 1/7  git pull"
git pull
NEW_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo inconnu)
PREV_SHA=$(cat "$APP_DIR/.deployed-sha" 2>/dev/null || echo inconnu)
echo "    version en ligne : $PREV_SHA  →  à mettre en ligne : $NEW_SHA"
log "début $PREV_SHA -> $NEW_SHA"
jlog début "$NEW_SHA" "$PREV_SHA"

# Image de base Node : retirée à chaque déploiement pour recevoir les correctifs de sécurité. Non bloquant si le réseau échoue.
docker pull node:22-slim || echo "    ⚠ docker pull node:22-slim a échoué : l'image locale existante sera utilisée"
echo "    Node dans l'image : $(docker run --rm node:22-slim node -v 2>/dev/null || echo inconnu)"

# ── Dossiers de données persistantes (montés dans /app/data) ────────────────
# Doivent exister avec des droits d'écriture pour le conteneur AVANT le premier upload : le conteneur ne peut pas créer un nouveau
# sous-dossier sous ./data (root:root, 755), seul un mkdir depuis l'hôte le peut. Idempotent.
mkdir -p "$APP_DIR/data/images" "$APP_DIR/data/logos" "$APP_DIR/data/backgrounds" "$APP_DIR/data/videos" "$APP_DIR/data/state" "$APP_DIR/data/media"
chmod 777 "$APP_DIR/data/images" "$APP_DIR/data/logos" "$APP_DIR/data/backgrounds" "$APP_DIR/data/videos" "$APP_DIR/data/state" "$APP_DIR/data/media"

echo "==> 2/7  moment du déploiement"
# Publications dues dans les 15 minutes (ou en retard) et transcriptions en cours, d'après l'application en ligne. Vérification impossible : on continue.
BUSY=$(docker compose exec -T app node -e "
const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient();
(async () => {
  const soon = new Date(Date.now() + 15 * 60000);
  const posts = await p.draft.count({ where: { status: 'programmé', scheduledAt: { lte: soon } } });
  const jobs = await p.mediaJob.count({ where: { status: { in: ['queued', 'processing'] } } });
  console.log('BUSY ' + posts + ' ' + jobs); await p.\$disconnect();
})().catch(() => console.log('BUSY ?'));
" 2>/dev/null | tr -d '\r' | grep '^BUSY' | tail -n1 || true)
case "$BUSY" in
  "BUSY 0 0") echo "    rien de proche : on peut y aller" ;;
  "BUSY ?"*|"") echo "    ⚠ vérification impossible (application arrêtée ?) : on continue" ;;
  BUSY\ *)
    set -- $BUSY
    echo "    ⚠ ${2} publication(s) due(s) dans les 15 minutes ou en retard, ${3} transcription(s) vidéo en cours."
    echo "      Un redémarrage maintenant peut retarder ces publications et perdre ces transcriptions."
    if [ "${FORCE:-0}" != "1" ]; then
      if [ -t 0 ]; then
        read -r -p "      Continuer quand même ? (o/N) " REP
        case "$REP" in o|O|oui|OUI) ;; *) echo "    Déploiement annulé."; log "annulé (publications ou transcriptions proches)"; jlog annulé "$NEW_SHA" "$PREV_SHA" "publications ou transcriptions proches"; exit 3 ;; esac
      else
        echo "    Déploiement annulé (session non interactive). FORCE=1 ./deploy.sh pour passer outre."; log "annulé (publications ou transcriptions proches)"; jlog annulé "$NEW_SHA" "$PREV_SHA" "publications ou transcriptions proches"; exit 3
      fi
    fi ;;
esac

# ── Lecture du .env sur l'hôte (avant d'entrer dans Docker) ─────────────────
# Le .env appartient à root:root rw-r-----, lisible par root sur l'hôte mais pas nécessairement par le root remappé du conteneur :
# on extrait les valeurs ici, puis on les passe via -e à docker run.
ENV_FILE=""
[ -f "$APP_DIR/.env" ]       && ENV_FILE="$APP_DIR/.env"
[ -z "$ENV_FILE" ] && [ -f "$APP_DIR/.env.local" ] && ENV_FILE="$APP_DIR/.env.local"
if [ -z "$ENV_FILE" ]; then
  echo "ERREUR : aucun fichier .env trouvé dans $APP_DIR/" >&2
  exit 1
fi
echo "    env file : $ENV_FILE"
getenv() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' || true; }
BUILD_DB_URL=$(getenv DATABASE_URL)
BUILD_VAPID=$(getenv NEXT_PUBLIC_VAPID_PUBLIC_KEY)
if [ -z "$BUILD_DB_URL" ]; then
  echo "ERREUR : DATABASE_URL introuvable dans $ENV_FILE" >&2
  exit 1
fi
# Réglages des garde-fous (facultatifs), lus dans le .env sans être exportés plus loin que nécessaire
export NEON_API_KEY="${NEON_API_KEY:-$(getenv NEON_API_KEY)}" NEON_PROJECT_ID="${NEON_PROJECT_ID:-$(getenv NEON_PROJECT_ID)}" NEON_KEEP_BRANCHES="${NEON_KEEP_BRANCHES:-$(getenv NEON_KEEP_BRANCHES)}"
export SMOKE_URL="${SMOKE_URL:-$(getenv SMOKE_URL)}" SMOKE_EMAIL="${SMOKE_EMAIL:-$(getenv SMOKE_EMAIL)}" SMOKE_PASSWORD="${SMOKE_PASSWORD:-$(getenv SMOKE_PASSWORD)}"

# Le contrôle automatique appelle l'adresse publique depuis ce serveur. Si le serveur ne peut pas la joindre (résolution du nom, pare-feu),
# le contrôle échouerait à chaque fois et déclencherait un retour arrière pour rien : on le désactive alors, avec un avertissement.
SMOKE_BASE="${SMOKE_URL:-https://postgenius.network}"
if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  REACH=$(curl -sk --max-time 10 -o /dev/null -w '%{http_code}' "${SMOKE_BASE%/}/" 2>/dev/null || true)
  if [ "$REACH" != "200" ]; then
    echo "    ⚠ ce serveur ne joint pas ${SMOKE_BASE} (code ${REACH:-000}) : le contrôle automatique après déploiement est DÉSACTIVÉ cette fois."
    echo "      Vérifiez à la main après le déploiement, ou définissez SMOKE_URL dans le .env."
    log "contrôle automatique désactivé (site injoignable depuis le serveur : ${REACH:-000})"
    SKIP_SMOKE=1
  fi
fi

echo "==> 3/7  copie de la base avant changement de schéma"
SCHEMA_CHANGED=1
if [ "$PREV_SHA" != "inconnu" ] && git cat-file -e "$PREV_SHA^{commit}" 2>/dev/null; then
  if [ -z "$(git diff --name-only "$PREV_SHA" HEAD -- prisma/schema.prisma)" ]; then SCHEMA_CHANGED=0; fi
fi
if [ "$SCHEMA_CHANGED" = "0" ]; then
  echo "    le schéma n'a pas changé depuis la version en ligne : pas de copie"
else
  SNAP=$("$SNAPSHOT" || true)
  case "$SNAP" in
    SNAPSHOT\ *) echo "    copie créée : ${SNAP#SNAPSHOT }"; log "copie base : ${SNAP#SNAPSHOT }" ;;
    *) echo "    ⚠ ${SNAP:-aucune réponse}"
       echo "      (le schéma change : sans copie Neon, le seul filet est la sauvegarde automatique de Neon. Voir DEPLOY.md pour configurer la copie.)"
       log "sans copie base" ;;
  esac
fi

echo "==> 4/7  build (conteneur), contrôle du schéma, puis changement de schéma si le build réussit"
set +e
docker run --rm --user root \
  -e BUILD_DB_URL="$BUILD_DB_URL" \
  -e BUILD_VAPID="$BUILD_VAPID" \
  -e ALLOW_DATA_LOSS="${ALLOW_DATA_LOSS:-0}" \
  -v "$APP_DIR":/host node:22-slim bash /host/scripts/build-in-container.sh
RC=$?
set -e
if [ "$RC" -ne 0 ]; then
  rm -rf "$APP_DIR/.next.new" "$APP_DIR/.prisma.new"
  if [ "$RC" -eq 20 ]; then
    echo "==> ARRÊT : changement de schéma destructif refusé. La version en ligne n'a pas changé."
    log "refusé : schéma destructif"; jlog refusé "$NEW_SHA" "$PREV_SHA" "schéma destructif"
  else
    echo "==> ARRÊT : le build a échoué (code $RC). La version en ligne n'a pas changé."
    log "échec build (code $RC)"; jlog échec "$NEW_SHA" "$PREV_SHA" "build (code $RC)"
  fi
  exit "$RC"
fi

echo "==> 5/7  mise en place (l'ancienne version est gardée dans .prev/)"
rm -rf "$APP_DIR/.prev"
mkdir -p "$APP_DIR/.prev"
[ -d "$APP_DIR/.next" ] && mv "$APP_DIR/.next" "$APP_DIR/.prev/next"
[ -d "$APP_DIR/node_modules/.prisma" ] && cp -r "$APP_DIR/node_modules/.prisma" "$APP_DIR/.prev/prisma-client"
echo "$PREV_SHA" > "$APP_DIR/.prev/sha"
mv "$APP_DIR/.next.new" "$APP_DIR/.next"
rm -rf "$APP_DIR/node_modules/.prisma"
mv "$APP_DIR/.prisma.new" "$APP_DIR/node_modules/.prisma"

echo "==> 6/7  redémarrage"
docker compose up -d --build --force-recreate app

echo "==> 7/7  contrôle automatique après déploiement"
if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  echo "    contrôle désactivé : vérifiez le site à la main."
  echo "$NEW_SHA" > "$APP_DIR/.deployed-sha"
  log "réussi $NEW_SHA (sans contrôle automatique)"; jlog réussi "$NEW_SHA" "$PREV_SHA" "sans contrôle automatique"; write_version
elif "$SMOKE"; then
  echo "$NEW_SHA" > "$APP_DIR/.deployed-sha"
  log "réussi $NEW_SHA"; jlog réussi "$NEW_SHA" "$PREV_SHA"; write_version
else
  echo ""
  echo "==> ÉCHEC du contrôle : retour automatique à la version précédente ($PREV_SHA)"
  log "contrôle échoué $NEW_SHA : retour arrière automatique"; jlog "retour automatique" "$NEW_SHA" "$PREV_SHA" "contrôle après déploiement échoué"
  if ROLLBACK_AUTO=1 "$APP_DIR/rollback.sh"; then
    echo "==> Retour arrière réussi : $PREV_SHA est de nouveau en ligne. Regardez : docker compose logs app"
  else
    echo "==> ⚠ Le retour arrière a lui aussi échoué. Lancez : ./deploy.legacy.sh après avoir annulé la fusion sur GitHub, ou contactez l'assistance."
  fi
  exit 1
fi

# ── Entretien disque ────────────────────────────────────────────────────────
docker image prune -f >/dev/null 2>&1 || true
# Le cache de construction ne sert à rien d'un déploiement à l'autre (l'image ne fait que copier le build) et s'accumulait :
# 9 Go constatés après quelques déploiements, disque à 80 %. `docker builder prune` ne touche jamais aux images ni aux données.
docker builder prune -af >/dev/null 2>&1 || true
echo "    disque : $(df -h / | awk 'NR==2{print $3" utilisés sur "$2" ("$5")"}')"
echo "==> Terminé : $NEW_SHA en ligne."
