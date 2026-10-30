#!/usr/bin/env bash
#
# Copie instantanée de la base Neon avant une mise en ligne : crée une branche « avant-deploy-AAAAMMJJ-HHMM » (copie à l'écriture : quelques
# secondes, sans coût de stockage tant que la branche ne diverge pas). En cas de problème, la branche permet de retrouver l'état d'avant.
# Réglages (voir DEPLOY.md) : NEON_API_KEY et NEON_PROJECT_ID ; NEON_KEEP_BRANCHES=N garde les N dernières branches « avant-deploy-* »
# et supprime les plus anciennes (jamais une autre branche).
# Sortie : « SNAPSHOT <nom> » ou « SANS-SNAPSHOT <raison> ». Code de sortie : toujours 0 (une copie ratée ne bloque pas la mise en ligne).
#
set -uo pipefail
if [ -z "${NEON_API_KEY:-}" ] || [ -z "${NEON_PROJECT_ID:-}" ]; then
  echo "SANS-SNAPSHOT NEON_API_KEY ou NEON_PROJECT_ID non défini"
  exit 0
fi
API="https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}"
AUTH=(-H "Authorization: Bearer ${NEON_API_KEY}" -H "Accept: application/json" -H "Content-Type: application/json")
NAME="avant-deploy-$(date +%Y%m%d-%H%M)"

resp=$(curl -s --max-time 30 -w '\n%{http_code}' "${AUTH[@]}" -X POST -d "{\"branch\":{\"name\":\"$NAME\"}}" "$API/branches" 2>/dev/null || printf '\n000')
status=$(echo "$resp" | tail -n1)
if [ "${status:0:1}" != "2" ]; then
  echo "SANS-SNAPSHOT l'API Neon a répondu $status"
  exit 0
fi
echo "SNAPSHOT $NAME"

# Nettoyage : ne garder que les N dernières branches « avant-deploy-* »
if [ -n "${NEON_KEEP_BRANCHES:-}" ] && [ "${NEON_KEEP_BRANCHES}" -gt 0 ] 2>/dev/null; then
  list=$(curl -s --max-time 30 "${AUTH[@]}" "$API/branches" 2>/dev/null || true)
  old=$(echo "$list" | python3 -c '
import json,sys,os
keep=int(os.environ["NEON_KEEP_BRANCHES"])
try: bs=json.load(sys.stdin).get("branches",[])
except Exception: bs=[]
mine=[b for b in bs if str(b.get("name","")).startswith("avant-deploy-") and not b.get("primary") and not b.get("default")]
mine.sort(key=lambda b:b.get("created_at",""), reverse=True)
for b in mine[keep:]: print(b["id"])
' 2>/dev/null || true)
  for id in $old; do
    curl -s --max-time 30 -o /dev/null "${AUTH[@]}" -X DELETE "$API/branches/$id" 2>/dev/null || true
  done
fi
exit 0
