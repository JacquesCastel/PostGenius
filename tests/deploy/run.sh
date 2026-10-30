#!/usr/bin/env bash
#
# Banc d'essai de deploy.sh et rollback.sh avec des doubles de docker, git, npm et npx : rejoue le déroulé complet, pannes comprises, sans
# toucher à un serveur. Usage : bash tests/deploy/run.sh   (depuis la racine du dépôt). Code de sortie : 0 si tout passe.
#
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
FAILS=0
ok() { echo "✓ $1"; }
ko() { echo "✗ ÉCHEC $1"; FAILS=$((FAILS + 1)); }
check() { if eval "$2"; then ok "$1"; else ko "$1"; fi; }

new_sandbox() {
  APP=$(mktemp -d)
  mkdir -p "$APP/scripts" "$APP/bin" "$APP/.next" "$APP/node_modules/.prisma" "$APP/prisma"
  cp "$REPO/deploy.sh" "$REPO/rollback.sh" "$REPO/scripts/build-in-container.sh" "$APP/scripts/" 2>/dev/null
  cp "$REPO/deploy.sh" "$REPO/rollback.sh" "$APP/"
  echo "DATABASE_URL=\"postgresql://x:y@localhost/db\"" > "$APP/.env"
  echo old > "$APP/.next/VERSION"; echo old > "$APP/node_modules/.prisma/VERSION"; echo aaa1111 > "$APP/.deployed-sha"
  : > "$APP/schema.prisma"; mkdir -p "$APP/prisma"; : > "$APP/prisma/schema.prisma"
  export APP_DIR="$APP" STUB_LOG="$APP/stub.log" STUB_ORDER="$APP/order.log"; : > "$STUB_LOG"; : > "$STUB_ORDER"
  # Doubles
  cat > "$APP/bin/git" <<'S'
#!/usr/bin/env bash
case "$1" in
  pull) exit 0;;
  rev-parse) echo "${STUB_NEW_SHA:-bbb2222}";;
  cat-file) exit 0;;
  diff) [ "${STUB_SCHEMA_CHANGED:-1}" = "1" ] && echo prisma/schema.prisma; exit 0;;
esac
S
  cat > "$APP/bin/docker" <<'S'
#!/usr/bin/env bash
echo "docker $*" >> "$STUB_LOG"
case "$1" in
  pull|image|builder) exit 0;;
  compose)
    case "$2" in
      exec) echo "${STUB_BUSY:-BUSY 0 0}"; exit 0;;
      up) echo up >> "$STUB_ORDER"; exit 0;;
    esac; exit 0;;
  run)
    shift; envs=(); host=""
    while [ $# -gt 0 ]; do
      case "$1" in
        -e) envs+=("$2"); shift 2;;
        -v) host="${2%%:*}"; shift 2;;
        --user) shift 2;;
        --rm) shift;;
        node:22-slim) shift; break;;
        *) shift;;
      esac
    done
    if [ "${1:-}" = "node" ]; then echo v22.0.0; exit 0; fi
    env "${envs[@]}" HOST_DIR="$host" WORK_DIR="$(mktemp -d)" bash "$host/scripts/build-in-container.sh"
    exit $?;;
esac
S
  cat > "$APP/bin/curl" <<'S'
#!/usr/bin/env bash
# curl factice : seule la vérification « le serveur joint son adresse publique » l'utilise
printf '%s' "${STUB_CURL_CODE:-200}"
S
  cat > "$APP/bin/npm" <<'S'
#!/usr/bin/env bash
[ "$1" = "ci" ] && mkdir -p node_modules/@fontsource node_modules/.bin
exit 0
S
  cat > "$APP/bin/npx" <<'S'
#!/usr/bin/env bash
case "$1 $2" in
  "prisma generate") mkdir -p node_modules/.prisma; echo new > node_modules/.prisma/VERSION;;
  "next build") echo build >> "$STUB_ORDER"; [ "${STUB_BUILD_FAIL:-0}" = "1" ] && exit 1; mkdir -p .next; echo new > .next/VERSION;;
  "prisma db") echo push >> "$STUB_ORDER"; echo "$*" >> "$STUB_LOG";;
esac
exit 0
S
  cat > "$APP/scripts/schema-gate.sh" <<'S'
#!/usr/bin/env bash
echo gate >> "$STUB_ORDER"; echo "-- diff factice" > "${2:-/tmp/x.sql}"
case "${STUB_GATE:-AUCUN}" in
  AUCUN) echo AUCUN; exit 0;; AJOUT) echo AJOUT; exit 0;; DESTRUCTIF) echo DESTRUCTIF; exit 20;; *) echo ERREUR; exit 1;;
esac
S
  cat > "$APP/scripts/smoke.sh" <<'S'
#!/usr/bin/env bash
echo smoke >> "$STUB_ORDER"
case "${STUB_SMOKE:-ok}" in
  ok) exit 0;; fail) exit 1;;
  fail_then_ok) n=$(cat "$APP_DIR/.smoke-n" 2>/dev/null || echo 0); echo $((n + 1)) > "$APP_DIR/.smoke-n"; [ "$n" -ge 1 ] && exit 0 || exit 1;;
esac
S
  cat > "$APP/scripts/neon-snapshot.sh" <<'S'
#!/usr/bin/env bash
echo snapshot >> "$STUB_ORDER"; echo "${STUB_NEON:-SNAPSHOT avant-deploy-test}"
S
  chmod +x "$APP"/bin/* "$APP"/scripts/*.sh "$APP/deploy.sh" "$APP/rollback.sh"
  export PATH="$APP/bin:$ORIG_PATH"
  unset STUB_NEW_SHA STUB_SCHEMA_CHANGED STUB_BUSY STUB_BUILD_FAIL STUB_GATE STUB_SMOKE STUB_NEON STUB_CURL_CODE FORCE ALLOW_DATA_LOSS SKIP_SMOKE SMOKE_URL
}
ORIG_PATH="$PATH"
run_deploy() { (cd "$APP" && bash ./deploy.sh </dev/null > "$APP/out.log" 2>&1); echo $?; }
order() { tr '\n' ' ' < "$STUB_ORDER"; }
ver() { cat "$APP/.next/VERSION" 2>/dev/null; }

echo "== 1. Déploiement nominal avec ajout de schéma"
new_sandbox; export STUB_GATE=AJOUT STUB_SCHEMA_CHANGED=1
RC=$(run_deploy)
check "réussit" '[ "$RC" = 0 ]'
check "l'ordre est : copie base, contrôle, build, changement de schéma, redémarrage, contrôle" '[ "$(order)" = "snapshot gate build push up smoke " ]'
check "la nouvelle version est en ligne" '[ "$(ver)" = new ]'
check "l'ancienne version est gardée dans .prev" '[ "$(cat $APP/.prev/next/VERSION)" = old ] && [ "$(cat $APP/.prev/sha)" = aaa1111 ]'
check "la version déployée est notée" '[ "$(cat $APP/.deployed-sha)" = bbb2222 ]'
check "le journal garde la trace" 'grep -q "réussi bbb2222" $APP/deploys.log'

echo "== 2. Schéma inchangé : ni copie ni changement de base"
new_sandbox; export STUB_GATE=AUCUN STUB_SCHEMA_CHANGED=0
RC=$(run_deploy)
check "réussit" '[ "$RC" = 0 ]'
check "pas de copie ni de changement de base" '[ "$(order)" = "gate build up smoke " ]'

echo "== 3. Changement destructif : refusé, rien ne bouge"
new_sandbox; export STUB_GATE=DESTRUCTIF
RC=$(run_deploy)
check "s'arrête avec le code 20" '[ "$RC" = 20 ]'
check "pas de build, pas de changement de base, pas de redémarrage" '! grep -qE "build|push|up" $STUB_ORDER'
check "la version en ligne est intacte" '[ "$(ver)" = old ] && [ ! -d $APP/.next.new ] && [ "$(cat $APP/.deployed-sha)" = aaa1111 ]'
check "le message explique comment passer outre" 'grep -q "ALLOW_DATA_LOSS=1" $APP/out.log'
echo "== 4. Même changement, autorisé explicitement"
new_sandbox; export STUB_GATE=DESTRUCTIF ALLOW_DATA_LOSS=1
RC=$(run_deploy)
check "réussit avec ALLOW_DATA_LOSS=1" '[ "$RC" = 0 ] && [ "$(ver)" = new ]'

echo "== 5. Le build échoue : la base n'est pas touchée"
new_sandbox; export STUB_GATE=AJOUT STUB_BUILD_FAIL=1
RC=$(run_deploy)
check "s'arrête en erreur" '[ "$RC" != 0 ]'
check "aucun changement de base après un build raté" '! grep -q push $STUB_ORDER'
check "la version en ligne est intacte et rien n'est redémarré" '[ "$(ver)" = old ] && ! grep -q "^up" $STUB_ORDER && [ ! -d $APP/.next.new ]'

echo "== 6. Le contrôle après déploiement échoue : retour automatique"
new_sandbox; export STUB_GATE=AJOUT STUB_SMOKE=fail_then_ok
RC=$(run_deploy)
check "le déploiement est signalé en échec" '[ "$RC" = 1 ]'
check "l'ancienne version est de nouveau en ligne" '[ "$(ver)" = old ] && [ "$(cat $APP/.deployed-sha)" = aaa1111 ]'
check "la version retirée est gardée pour analyse" '[ "$(cat $APP/.rolledback/next/VERSION)" = new ]'
check "le journal raconte les deux temps" 'grep -q "retour arrière automatique" $APP/deploys.log && grep -q "retour arrière réussi" $APP/deploys.log'

echo "== 7. Publication proche ou transcription en cours"
new_sandbox; export STUB_GATE=AJOUT STUB_BUSY="BUSY 2 1"
RC=$(run_deploy)
check "session non interactive : annulé (code 3), rien n'est lancé" '[ "$RC" = 3 ] && ! grep -q build $STUB_ORDER && [ "$(ver)" = old ]'
check "le message cite les 2 publications et la transcription" 'grep -q "2 publication" $APP/out.log && grep -q "1 transcription" $APP/out.log'
new_sandbox; export STUB_GATE=AJOUT STUB_BUSY="BUSY 2 1" FORCE=1
RC=$(run_deploy)
check "FORCE=1 : on passe outre" '[ "$RC" = 0 ] && [ "$(ver)" = new ]'
new_sandbox; export STUB_GATE=AJOUT STUB_BUSY="BUSY ?"
RC=$(run_deploy)
check "vérification impossible : on continue avec un avertissement" '[ "$RC" = 0 ] && grep -q "vérification impossible" $APP/out.log'

echo "== 8. Retour arrière manuel"
new_sandbox; export STUB_GATE=AJOUT
RC=$(run_deploy)
RB=$(cd "$APP" && bash ./rollback.sh </dev/null > "$APP/rb.log" 2>&1; echo $?)
check "le retour arrière réussit" '[ "$RB" = 0 ]'
check "l'ancienne version est en ligne et notée" '[ "$(ver)" = old ] && [ "$(cat $APP/.deployed-sha)" = aaa1111 ]'
RB2=$(cd "$APP" && bash ./rollback.sh </dev/null > "$APP/rb2.log" 2>&1; echo $?)
check "un second retour arrière est refusé proprement" '[ "$RB2" = 1 ] && grep -q "aucune version précédente" $APP/rb2.log'

echo "== 9. Copie de la base impossible : on déploie quand même, avec un avertissement"
new_sandbox; export STUB_GATE=AJOUT STUB_NEON="SANS-SNAPSHOT NEON_API_KEY ou NEON_PROJECT_ID non défini"
RC=$(run_deploy)
check "réussit" '[ "$RC" = 0 ] && [ "$(ver)" = new ]'
check "l'absence de copie est signalée et journalisée" 'grep -q "SANS-SNAPSHOT" $APP/out.log && grep -q "sans copie base" $APP/deploys.log'

echo "== 10. Premier déploiement (aucune version notée) : copie de précaution"
new_sandbox; rm -f "$APP/.deployed-sha"; export STUB_GATE=AJOUT STUB_SCHEMA_CHANGED=0
RC=$(run_deploy)
check "réussit et tente la copie de la base" '[ "$RC" = 0 ] && grep -q snapshot $STUB_ORDER'

echo "== 11. Le serveur ne joint pas son adresse publique : contrôle désactivé, pas de retour arrière pour rien"
new_sandbox; export STUB_GATE=AJOUT STUB_CURL_CODE=000 STUB_SMOKE=fail
RC=$(run_deploy)
check "le déploiement réussit malgré un contrôle qui échouerait" '[ "$RC" = 0 ] && [ "$(ver)" = new ]'
check "le contrôle n'est pas lancé et l'avertissement est affiché" '! grep -q smoke $STUB_ORDER && grep -q "DÉSACTIVÉ" $APP/out.log'
check "la version est notée et le journal le précise" '[ "$(cat $APP/.deployed-sha)" = bbb2222 ] && grep -q "sans contrôle automatique" $APP/deploys.log'

echo "== 12. Le build ne copie pas les dossiers de retour arrière"
new_sandbox; export STUB_GATE=AJOUT
mkdir -p "$APP/.prev/next" "$APP/.rolledback/next"; echo gros > "$APP/.prev/next/gros"; echo gros > "$APP/.rolledback/next/gros"
cp "$REPO/scripts/build-in-container.sh" "$APP/scripts/"
W=$(mktemp -d)
(cd "$APP" && env BUILD_DB_URL=x HOST_DIR="$APP" WORK_DIR="$W" bash scripts/build-in-container.sh >/dev/null 2>&1)
check "ni .prev ni .rolledback ne sont recopiés dans le dossier de build" '[ ! -e "$W/.prev" ] && [ ! -e "$W/.rolledback" ]'

echo
if [ "$FAILS" = 0 ]; then echo "TOUT PASSE"; else echo "$FAILS ÉCHEC(S)"; fi
exit "$FAILS"
