# Propositions de Caddyfile (non appliquées : ne pas copier telles quelles sur le serveur sans relecture)

Le `Caddyfile` du dépôt n'est **pas modifié** : `docker-compose.yml` le monte dans Caddy, un déploiement l'appliquerait. Adresses à adapter.

## A. Mesure de protection immédiate : servir `postgenius.network` directement
À utiliser si `postgenius.network` répond aujourd'hui sans redirection (voir `migration-domaine-301.md`, section 0). Il supprime le risque de panne au prochain rechargement.

```caddyfile
postgenius.network, www.postgenius.network {
	reverse_proxy app:3000
}

# linkeepost.app : à garder seulement si son DNS pointe vers ce serveur
linkeepost.app {
	reverse_proxy app:3000
}
www.linkeepost.app {
	redir https://linkeepost.app{uri} permanent
}
```

## B. Servir le nouveau domaine en parallèle (étape 2, sans redirection)
```caddyfile
vercea.app {
	reverse_proxy app:3000
}
www.vercea.app {
	redir https://vercea.app{uri} permanent
}

# les blocs de la proposition A restent en place
```

## C. Les 301 de domaine (étape 3 : seulement après le renommage du site)
```caddyfile
vercea.app {
	reverse_proxy app:3000
}
www.vercea.app {
	redir https://vercea.app{uri} permanent
}

# Anciens domaines : les pages (GET, HEAD) partent en 301, chemin et requête conservés ; les autres méthodes
# (webhooks, appels d'API) restent servies pendant la transition.
postgenius.network, www.postgenius.network, linkeepost.app, www.linkeepost.app {
	@pages method GET HEAD
	redir @pages https://vercea.app{uri} permanent
	reverse_proxy app:3000
}
```
Un certificat n'est obtenu pour un domaine que si son DNS pointe vers ce serveur ; sinon retirer le domaine de la liste et rediriger chez le registraire.
