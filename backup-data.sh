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
# - Copie hors serveur OPTIONNELLE : si BACKUP_RSYNC_TARGET est défini
#   (ex. user@hote:/chemin/), l'archive y est envoyée par rsync. Une sauvegarde
#   qui reste sur le même disque ne protège pas d'une perte du serveur.
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
  rsync -a "$FILE" "$BACKUP_RSYNC_TARGET"
  echo "copie hors serveur OK : $BACKUP_RSYNC_TARGET"
fi
