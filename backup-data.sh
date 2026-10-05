#!/usr/bin/env bash
#
# Sauvegarde du dossier data (images générées, logos, fonds, médiathèque) de
# LinkeePost. La base est sur Neon (snapshots gérés par Neon) : seul ./data vit
# uniquement sur ce serveur.
#
# - Archive datée tar.gz dans /opt/postgenius-backups (HORS du dépôt et de data/,
#   donc jamais touchée par un déploiement ni incluse dans l'archive suivante).
# - Conserve les 14 dernières archives, supprime les plus anciennes.
# - health.json (régénéré toutes les 5 min) est exclu : inutile à restaurer.
# - Copie hors serveur (Hetzner Storage Box) : si BACKUP_RSYNC_TARGET est défini,
#   le dossier d'archives est reflété par rsync/SSH vers cette destination
#   (--delete : la copie distante garde exactement les mêmes archives que le
#   serveur, donc la même rotation). Une sauvegarde qui reste sur le même disque
#   ne protège pas d'une perte du serveur.
#   Réglages dans /opt/postgenius/backup.env (hors dépôt, lu par le script) :
#     BACKUP_RSYNC_TARGET=u123456@u123456.your-storagebox.de:postgenius-backups/
#     BACKUP_SSH_KEY=/root/.ssh/postgenius_backup     (défaut)
#     BACKUP_SSH_PORT=23                              (défaut, port Storage Box)
#   Tester la liaison sans rien envoyer :  ./backup-data.sh --test-remote
#   Code de sortie 2 : sauvegarde locale OK mais copie hors serveur en échec.
#
# Installation (une fois) : crontab -e puis ajouter
#   30 3 * * * /opt/postgenius/backup-data.sh >> /var/log/postgenius-backup.log 2>&1
#
# Restauration : voir DEPLOY.md, section Sauvegardes.
#
set -euo pipefail

BASE_DIR="${BASE_DIR:-/opt/postgenius}"
BACKUP_DIR="${BACKUP_DIR:-/opt/postgenius-backups}"
KEEP="${KEEP:-14}"

# Réglages de la copie hors serveur (fichier hors dépôt, droits 600)
CONFIG="${BACKUP_CONFIG:-$BASE_DIR/backup.env}"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"
BACKUP_SSH_KEY="${BACKUP_SSH_KEY:-/root/.ssh/postgenius_backup}"
BACKUP_SSH_PORT="${BACKUP_SSH_PORT:-23}"
SSH_CMD="ssh -p $BACKUP_SSH_PORT -i $BACKUP_SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30"

if [ "${1:-}" = "--test-remote" ]; then
  [ -n "${BACKUP_RSYNC_TARGET:-}" ] || { echo "BACKUP_RSYNC_TARGET non défini (voir $CONFIG)" >&2; exit 1; }
  echo "Liaison vers $BACKUP_RSYNC_TARGET (port $BACKUP_SSH_PORT, clé $BACKUP_SSH_KEY) :"
  if rsync --list-only -e "$SSH_CMD" "$BACKUP_RSYNC_TARGET"; then
    echo "OK : destination joignable."
    exit 0
  fi
  echo "ERREUR : destination injoignable (clé non installée ? port ? chemin ?)" >&2
  exit 1
fi

[ -d "$BASE_DIR/data" ] || { echo "ERREUR : $BASE_DIR/data introuvable" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/data-$STAMP.tar.gz"

tar -czf "$FILE.tmp" -C "$BASE_DIR" --exclude='data/health.json' --exclude='data/health.json.tmp' data
# Vérifie que l'archive se relit avant de la valider
tar -tzf "$FILE.tmp" >/dev/null
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
echo "$(date -u +%FT%TZ) sauvegarde OK : $FILE ($(du -h "$FILE" | cut -f1))"

# Rotation : on garde les $KEEP plus récentes (les noms se trient par date)
ls -1 "$BACKUP_DIR"/data-*.tar.gz 2>/dev/null | sort | head -n -"$KEEP" | while read -r old; do
  rm -f "$old"
  echo "ancienne archive supprimée : $old"
done

if [ -n "${BACKUP_RSYNC_TARGET:-}" ]; then
  # Reflet du dossier d'archives (rotation comprise). Une panne réseau ne doit pas
  # faire perdre la sauvegarde locale, déjà faite : on signale par le code 2.
  if rsync -a --delete --partial --exclude='*.tmp' -e "$SSH_CMD" "$BACKUP_DIR"/ "$BACKUP_RSYNC_TARGET"; then
    echo "$(date -u +%FT%TZ) copie hors serveur OK : $BACKUP_RSYNC_TARGET"
  else
    echo "$(date -u +%FT%TZ) ERREUR : copie hors serveur en échec ($BACKUP_RSYNC_TARGET)" >&2
    exit 2
  fi
fi
