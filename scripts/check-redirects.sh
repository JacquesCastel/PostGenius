#!/usr/bin/env bash
# Contrôle des redirections de domaine après la bascule (lecture seule : requêtes HEAD).
#   scripts/check-redirects.sh https://vercea.app postgenius.network linkeepost.app
# Pour chaque ancien domaine : statut attendu 301, adresse cible sur le nouveau domaine, chemin et requête conservés.
set -u
NEW="${1:?usage: check-redirects.sh https://nouveau-domaine ancien1 [ancien2 ...]}"; shift
PATHS=("/" "/blog" "/contact?x=1" "/valider/abc123" "/rapport/abc123" "/privacy-policy" "/tarifs")
fail=0
for host in "$@"; do
  for p in "${PATHS[@]}"; do
    out=$(curl -sI --max-time 15 "https://$host$p" | tr -d '\r')
    code=$(printf '%s' "$out" | head -1 | awk '{print $2}')
    loc=$(printf '%s' "$out" | awk -F': ' 'tolower($1)=="location"{print $2}')
    if [ "$code" = "301" ] && [ "$loc" = "$NEW$p" ]; then echo "OK    $host$p -> $loc"; else echo "ÉCART $host$p : statut ${code:-aucun}, location ${loc:-aucune} (attendu 301 -> $NEW$p)"; fail=1; fi
  done
done
exit $fail
