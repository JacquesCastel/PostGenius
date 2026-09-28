#!/usr/bin/env bash
#
# Rapport de santé serveur pour l'onglet Admin > Système de LinkeePost.
#
# POURQUOI CE SCRIPT : le conteneur applicatif n'a ni accès au socket Docker
# ni SSH vers l'hôte (volontairement, pour la sécurité). On collecte donc
# l'état du serveur ICI, côté hôte, via cron, et on écrit un JSON dans le
# volume de données déjà monté dans le conteneur (./data → /app/data) —
# l'app n'a plus qu'à le lire, comme un fichier normal. Construit avec
# python3 (jq non installé sur ce serveur) pour un échappement JSON correct
# des lignes de logs.
#
# Installation (une fois) : crontab -e puis ajouter
#   */5 * * * * /opt/postgenius/health-check.sh
#
set -euo pipefail
cd /opt/postgenius

OUT=/opt/postgenius/data/health.json

DISK_LINE=$(df -P / | awk 'NR==2{gsub("%","",$5); print $2*1024, $3*1024, $4*1024, $5}')
CONTAINERS=$(docker compose ps --format json 2>/dev/null || echo "")
ERRORS=$(docker compose logs app --since 15m 2>&1 \
  | grep -iE 'error|exception|fatal|ECONNREFUSED|EACCES' \
  | grep -v 'Server Action' \
  | tail -20 || true)

OUT="$OUT" DISK_LINE="$DISK_LINE" CONTAINERS="$CONTAINERS" ERRORS="$ERRORS" python3 -c '
import json, os, datetime

disk_size, disk_used, disk_avail, disk_pct = os.environ["DISK_LINE"].split()
containers = []
for line in os.environ["CONTAINERS"].splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        c = json.loads(line)
        containers.append({"name": c.get("Name"), "service": c.get("Service"), "state": c.get("State"), "status": c.get("Status")})
    except json.JSONDecodeError:
        pass

error_lines = [l for l in os.environ["ERRORS"].splitlines() if l.strip()]

out = {
    "generatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "disk": {
        "totalBytes": int(disk_size),
        "usedBytes": int(disk_used),
        "availableBytes": int(disk_avail),
        "usedPercent": int(disk_pct),
    },
    "containers": containers,
    "errors15m": {"count": len(error_lines), "lines": error_lines},
}
with open(os.environ["OUT"] + ".tmp", "w") as f:
    json.dump(out, f)
os.replace(os.environ["OUT"] + ".tmp", os.environ["OUT"])
os.chmod(os.environ["OUT"], 0o644)
'
