#!/usr/bin/env bash
#
# Garde-fou des changements de schéma : compare la base (DATABASE_URL) au schéma Prisma et classe la différence.
#   Sortie standard : AUCUN (rien à changer) | AJOUT (tables, colonnes, index… : rien n'est perdu) | DESTRUCTIF (suppression de table ou
#   de colonne, changement de type, vidage : des données peuvent être perdues) | ERREUR (comparaison impossible).
#   Code de sortie : 0 (AUCUN, AJOUT), 20 (DESTRUCTIF), 1 (ERREUR). Le SQL de la différence est écrit dans le fichier donné en 2e argument.
# Usage : DATABASE_URL=… scripts/schema-gate.sh [prisma/schema.prisma] [/tmp/schema-diff.sql]
#
set -uo pipefail
SCHEMA="${1:-prisma/schema.prisma}"
OUT="${2:-/tmp/schema-diff.sql}"
: "${DATABASE_URL:?DATABASE_URL manquante}"

if ! npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel "$SCHEMA" --script --output "$OUT" >/dev/null 2>"$OUT.err"; then
  echo ERREUR
  cat "$OUT.err" >&2
  exit 1
fi

# Instructions SQL, une par ligne, sans commentaires
SQL=$(grep -vE '^[[:space:]]*(--|$)' "$OUT" | tr '\n' ' ' | sed 's/;/;\n/g' | sed '/^[[:space:]]*$/d' || true)
if [ -z "$SQL" ]; then echo AUCUN; exit 0; fi
if echo "$SQL" | grep -qiE 'DROP[[:space:]]+(TABLE|COLUMN|TYPE)|SET[[:space:]]+DATA[[:space:]]+TYPE|TRUNCATE|DELETE[[:space:]]+FROM'; then
  echo DESTRUCTIF
  exit 20
fi
echo AJOUT
exit 0
