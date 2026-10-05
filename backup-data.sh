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
# - État écrit dans data/backup-status.json à chaque passage (réussite ou échec) :
#   lu par l'onglet Administration, qui alerte (et envoie un email) si la
#   sauvegarde ou la copie distante est en échec ou n'a pas eu lieu depuis 36 h.
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

# ── État de la dernière exécution (data/backup-status.json) ────────────────
# Écrit à la sortie du script quoi qu'il arrive (trap EXIT) : les "dernières
# réussites" sont reprises du fichier précédent quand l'exécution échoue.
STATUS_FILE="$BASE_DIR/data/backup-status.json"
LOCAL_STATUS=error;  LOCAL_ERR="interrompue avant la fin (voir /var/log/postgenius-backup.log)"
REMOTE_STATUS=disabled; REMOTE_ERR=""
LAST_FILE=""; ARCHIVES=0
[ -n "${BACKUP_RSYNC_TARGET:-}" ] && { REMOTE_STATUS=error; REMOTE_ERR="interrompue avant la fin"; }

write_status() {
  STATUS_FILE="$STATUS_FILE" LOCAL_STATUS="$LOCAL_STATUS" LOCAL_ERR="$LOCAL_ERR" \
  REMOTE_STATUS="$REMOTE_STATUS" REMOTE_ERR="$REMOTE_ERR" FILE="$LAST_FILE" ARCHIVES="$ARCHIVES" \
  python3 -c '
import json, os, datetime
f = os.environ["STATUS_FILE"]
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
try:
    prev = json.load(open(f))
except Exception:
    prev = {}
def block(name, status, err, extra):
    p = prev.get(name) or {}
    b = {"status": status, "at": now, "lastSuccessAt": now if status == "ok" else p.get("lastSuccessAt")}
    if status == "error":
        b["error"] = err
    b.update(extra)
    return b
file = os.environ["FILE"]
size = os.path.getsize(file) if file and os.path.exists(file) else None
local = block("local", os.environ["LOCAL_STATUS"], os.environ["LOCAL_ERR"],
              {"file": os.path.basename(file) if file else (prev.get("local") or {}).get("file"),
               "bytes": size if size is not None else (prev.get("local") or {}).get("bytes"),
               "archives": int(os.environ["ARCHIVES"]) or (prev.get("local") or {}).get("archives")})
remote = block("remote", os.environ["REMOTE_STATUS"], os.environ["REMOTE_ERR"], {})
remote["configured"] = os.environ["REMOTE_STATUS"] != "disabled"
if not remote["configured"]:
    remote["lastSuccessAt"] = None
json.dump({"generatedAt": now, "local": local, "remote": remote}, open(f + ".tmp", "w"))
os.replace(f + ".tmp", f)
os.chmod(f, 0o644)
' || echo "avertissement : état de sauvegarde non écrit" >&2
}
trap write_status EXIT

STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/data-$STAMP.tar.gz"

tar -czf "$FILE.tmp" -C "$BASE_DIR" --exclude='data/health.json' --exclude='data/health.json.tmp' --exclude='data/backup-status.json*' data
# Vérifie que l'archive se relit avant de la valider
tar -tzf "$FILE.tmp" >/dev/null
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
LOCAL_STATUS=ok; LOCAL_ERR=""; LAST_FILE="$FILE"
echo "$(date -u +%FT%TZ) sauvegarde OK : $FILE ($(du -h "$FILE" | cut -f1))"

# Rotation : on garde les $KEEP plus récentes (les noms se trient par date)
ls -1 "$BACKUP_DIR"/data-*.tar.gz 2>/dev/null | sort | head -n -"$KEEP" | while read -r old; do
  rm -f "$old"
  echo "ancienne archive supprimée : $old"
done

ARCHIVES=$(ls -1 "$BACKUP_DIR"/data-*.tar.gz 2>/dev/null | wc -l)

if [ -n "${BACKUP_RSYNC_TARGET:-}" ]; then
  # Reflet du dossier d'archives (rotation comprise). Une panne réseau ne doit pas
  # faire perdre la sauvegarde locale, déjà faite : on signale par le code 2.
  if rsync -a --delete --partial --exclude='*.tmp' -e "$SSH_CMD" "$BACKUP_DIR"/ "$BACKUP_RSYNC_TARGET"; then
    REMOTE_STATUS=ok; REMOTE_ERR=""
    echo "$(date -u +%FT%TZ) copie hors serveur OK : $BACKUP_RSYNC_TARGET"
  else
    REMOTE_ERR="rsync a échoué (liaison, clé ou chemin) — voir le journal"
    echo "$(date -u +%FT%TZ) ERREUR : copie hors serveur en échec ($BACKUP_RSYNC_TARGET)" >&2
    exit 2
  fi
fi
