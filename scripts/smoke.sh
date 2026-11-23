#!/usr/bin/env bash
#
# Contrôle après déploiement : l'application répond-elle vraiment, et fait-elle l'essentiel ?
#   - santé : l'application tourne ET joint la base (/api/health) ;
#   - page d'accueil servie et non vide (garde-fou du bug de rendu à vide de ce serveur) ;
#   - page des offres, état de session, métadonnées OAuth ;
#   - si SMOKE_EMAIL et SMOKE_PASSWORD sont définis (compte de contrôle) : connexion réelle, puis lecture de la session.
# Usage : scripts/smoke.sh [adresse]   (défaut : $SMOKE_URL, sinon https://postgenius.network)
# Code de sortie : 0 si tout est bon, 1 sinon. Attend jusqu'à SMOKE_WAIT secondes (45 par défaut) que l'application démarre.
#
set -uo pipefail
URL="${1:-${SMOKE_URL:-https://postgenius.network}}"
URL="${URL%/}"
WAIT="${SMOKE_WAIT:-45}"
MIN_LANDING="${SMOKE_MIN_LANDING:-30000}"
C=(curl -sk --max-time 15)
fail=0
ok() { echo "    ✓ $1"; }
ko() { echo "    ✗ $1"; fail=1; }
code() { local c; c=$("${C[@]}" -o /dev/null -w "%{http_code}" "$@" 2>/dev/null); echo "${c:-000}"; }

# 1. Attendre le démarrage
end=$((SECONDS + WAIT))
until [ "$(code "$URL/api/health")" = "200" ]; do
  [ "$SECONDS" -ge "$end" ] && break
  sleep 2
done

# 2. Santé (application + base)
body=$("${C[@]}" "$URL/api/health" 2>/dev/null || true)
if echo "$body" | grep -q '"ok":true'; then ok "santé : application et base joignables"; else ko "santé : /api/health ne répond pas correctement (${body:-aucune réponse})"; fi

# 3. Page d'accueil non vide
landing=$("${C[@]}" "$URL/" 2>/dev/null || true)
if [ "${#landing}" -gt "$MIN_LANDING" ]; then ok "page d'accueil servie (${#landing} caractères)"; else ko "page d'accueil vide ou trop courte (${#landing} caractères, minimum $MIN_LANDING)"; fi

# 4. Pages et points d'accès publics
for path in /tarifs /fonctionnalites /securite /.well-known/oauth-authorization-server; do
  c=$(code "$URL$path")
  if [ "$c" = "200" ]; then ok "$path : 200"; else ko "$path : code $c"; fi
done
me=$("${C[@]}" "$URL/api/auth/me" 2>/dev/null || true)
if echo "$me" | grep -q '"user"'; then ok "/api/auth/me : réponse correcte"; else ko "/api/auth/me : réponse inattendue (${me:-aucune réponse})"; fi

# 5. Connexion réelle avec le compte de contrôle (facultatif)
if [ -n "${SMOKE_EMAIL:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ]; then
  jar=$(mktemp)
  payload=$(python3 -c 'import json,os;print(json.dumps({"email":os.environ["SMOKE_EMAIL"],"password":os.environ["SMOKE_PASSWORD"]}))')
  lc=$("${C[@]}" -o /dev/null -w '%{http_code}' -c "$jar" -X POST -H 'Content-Type: application/json' -d "$payload" "$URL/api/auth/login" 2>/dev/null || echo 000)
  if [ "$lc" = "200" ]; then
    who=$("${C[@]}" -b "$jar" "$URL/api/auth/me" 2>/dev/null || true)
    if echo "$who" | tr 'A-Z' 'a-z' | grep -q "$(echo "$SMOKE_EMAIL" | tr 'A-Z' 'a-z')"; then ok "connexion du compte de contrôle : réussie"; else ko "connexion : session non reconnue après connexion"; fi
  else
    ko "connexion du compte de contrôle : code $lc"
  fi
  rm -f "$jar"
else
  echo "    · connexion non testée (SMOKE_EMAIL et SMOKE_PASSWORD non définis)"
fi

if [ "$fail" -eq 0 ]; then echo "    ==> Contrôle réussi"; exit 0; fi
echo "    ==> Contrôle ÉCHOUÉ"
exit 1
