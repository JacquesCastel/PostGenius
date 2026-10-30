#!/usr/bin/env bash
#
# Exécuté DANS le conteneur de build lancé par deploy.sh (/host = dossier de l'application sur le serveur).
# Ordre voulu, pour qu'un échec ne laisse rien de cassé :
#   1. contrôle du schéma (lecture seule) : refus si des données seraient perdues, sauf ALLOW_DATA_LOSS=1 ;
#   2. build de l'application ;
#   3. SEULEMENT si le build a réussi : changement de schéma de la base de production ;
#   4. dépôt du résultat dans des dossiers d'attente (.next.new, .prisma.new) : la version en ligne n'est pas touchée ici.
# Codes de sortie : 0 réussi ; 20 changement de schéma destructif refusé ; autre : échec (rien n'a été modifié en ligne).
#
set -euo pipefail
HOST="${HOST_DIR:-/host}"
WORK="${WORK_DIR:-/b}"
: "${BUILD_DB_URL:?BUILD_DB_URL manquante}"

mkdir -p "$WORK"
cd "$WORK"
# Copie du dépôt, sans les versions gardées pour le retour arrière ni les dossiers d'attente (inutiles et volumineux)
tar -C "$HOST" --exclude=./.prev --exclude=./.rolledback --exclude=./.next.new --exclude=./.prisma.new --exclude=./.git --exclude=./.next --exclude=./node_modules --exclude=./.env --exclude=./.env.local -cf - . | tar -xf -
rm -rf .next node_modules .env .env.local .git .next.new .prisma.new .prev .rolledback
npm ci

echo "    [1/4] contrôle du schéma de la base de production"
set +e
GATE=$(DATABASE_URL="$BUILD_DB_URL" bash scripts/schema-gate.sh prisma/schema.prisma "$HOST/.schema-diff.sql")
GC=$?
set -e
echo "    schéma : ${GATE:-?}"
if [ "$GC" -eq 20 ] && [ "${ALLOW_DATA_LOSS:-0}" != "1" ]; then
  echo "" >&2
  echo "ERREUR : ce déploiement supprimerait ou transformerait des données de la base (voir $HOST/.schema-diff.sql)." >&2
  echo "         Rien n'a été modifié. Si c'est voulu, après avoir vérifié le fichier : ALLOW_DATA_LOSS=1 ./deploy.sh" >&2
  exit 20
fi
if [ "$GC" -ne 0 ] && [ "$GC" -ne 20 ]; then
  echo "ERREUR : comparaison du schéma impossible. Rien n'a été modifié." >&2
  exit 1
fi

echo "    [2/4] build de l'application"
(
  # Build avec une base factice (landing/blog sont rendus à la requête) ; clé VAPID publique inlinée au build
  export DATABASE_URL="postgresql://build:build@localhost:5432/build"
  export NEXT_PUBLIC_VAPID_PUBLIC_KEY="${BUILD_VAPID:-}"
  npx prisma generate
  npx next build
)

echo "    [3/4] changement de schéma de la base (après build réussi)"
if [ "${GATE:-}" = "AUCUN" ]; then
  echo "    rien à changer"
else
  # Le contrôle ci-dessus a écarté les suppressions : --accept-data-loss ne sert qu'aux ajouts de contrainte UNIQUE sur colonnes nullables
  DATABASE_URL="$BUILD_DB_URL" npx prisma db push --skip-generate --accept-data-loss
fi

echo "    [4/4] dépôt du build dans les dossiers d'attente"
rm -rf "$HOST/.next.new" "$HOST/.prisma.new"
cp -r .next "$HOST/.next.new"
cp -r node_modules/.prisma "$HOST/.prisma.new"
mkdir -p "$HOST/node_modules"
rm -rf "$HOST/node_modules/@fontsource"
cp -r node_modules/@fontsource "$HOST/node_modules/@fontsource"
echo "${GATE:-?}" > "$HOST/.schema-state"
