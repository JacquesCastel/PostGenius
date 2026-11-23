#!/usr/bin/env bash
#
# Relance l'audit de profondeur des mesures de performance (deux requêtes, LECTURE SEULE) et garde le résultat daté.
#
# Usage, sur le serveur :  cd /opt/postgenius && ./scripts/audit-profondeur.sh
#   DATABASE_URL     adresse de la base (sinon lue dans .env, sans jamais être affichée)
#   AUDIT_OUT_DIR    dossier des résultats (défaut : data/audits, hors dépôt git)
#   AUDIT_DOCKER=1   force l'usage d'un conteneur postgres jetable au lieu de `psql` installé
#
# Ne modifie ni l'application, ni la base (chaque requête ouvre une transaction BEGIN READ ONLY puis ROLLBACK), ni le dépôt.
# Le résultat ne contient que des comptages : il peut être collé tel quel dans une conversation.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${AUDIT_OUT_DIR:-$ROOT/data/audits}"
mkdir -p "$OUT_DIR"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$ROOT/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/.env" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
fi
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL introuvable (variable d'environnement ou .env)." >&2; exit 1; }

if [ "${AUDIT_DOCKER:-0}" != "1" ] && command -v psql >/dev/null 2>&1; then
  run_sql() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -f "$1"; }
elif command -v docker >/dev/null 2>&1; then
  run_sql() { docker run --rm -i postgres:16-alpine psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -f - < "$1"; }
else
  echo "Ni psql ni docker disponibles : installer le client PostgreSQL (apt install postgresql-client) ou Docker." >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$OUT_DIR/audit-$STAMP.txt"
{
  echo "Audit de la profondeur des mesures — $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "=== 1. Profondeur : comptes et posts mesurés ==="
  run_sql "$ROOT/scripts/audit-profondeur-mesures.sql"
  echo
  echo "=== 2. Âges réels des mesures, posts sans mesure, traçabilité, campagnes ==="
  run_sql "$ROOT/scripts/audit-ages-mesures.sql"
} 2>&1 | tee "$OUT"
echo
echo "Résultat gardé dans : $OUT"
PREV="$(ls -1 "$OUT_DIR"/audit-*.txt 2>/dev/null | grep -v "$OUT" | tail -1 || true)"
[ -n "$PREV" ] && echo "Audit précédent : $PREV  (comparer : diff \"$PREV\" \"$OUT\")"
exit 0
