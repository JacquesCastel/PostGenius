# Migration de domaine et redirections 301 (11 novembre 2026)

**Statut : plan, rien n'est exécuté.** Je ne peux ni acheter un domaine, ni toucher au serveur : les étapes marquées « Jacques » sont à faire de votre côté. Les maquettes restent la priorité du site ; ce document ne change aucun code.

## 0. À vérifier d'abord : un risque d'indisponibilité qui existe déjà
Le `Caddyfile` du dépôt redirige **`postgenius.network` vers `linkeepost.app`** en 301 (voir aussi `DEPLOY.md`, ligne 19). Or, le 10 novembre, `linkeepost.app` ne pointait pas vers votre serveur et le site répondait sur `postgenius.network`. Deux explications possibles :
- le serveur n'a pas rechargé ce `Caddyfile` (il tourne avec une ancienne version) : **au prochain redémarrage ou rechargement de Caddy, `postgenius.network` redirigerait vers une adresse qui ne répond pas**, et le site deviendrait inaccessible ;
- le serveur utilise un autre fichier que celui du dépôt.

Commandes de lecture seule à lancer sur le serveur, puis coller les résultats :

```bash
curl -sI https://postgenius.network | head -5
```

```bash
cd /opt/postgenius && git status --short Caddyfile && git log -1 --format='%h %ad' --date=short -- Caddyfile
```

```bash
docker compose exec -T caddy cat /etc/caddy/Caddyfile
```

```bash
dig +short A linkeepost.app; dig +short A postgenius.network; dig +short MX linkeepost.app
```

**Si `postgenius.network` répond 200 sans redirection alors que le fichier du dépôt dit le contraire :** remplacer le `Caddyfile` par la proposition A de `caddyfile-propositions.md` **avant** tout autre déploiement.

## 1. Acheter le domaine (Jacques)
- **Quoi** : `vercea.app` (34,99 $/an dans votre liste ; vérifier le prix de renouvellement). `vercea.fr` en plus est un bon second choix, utile pour protéger le nom.
- **Avant de payer** : les registres de marque (INPI, EUIPO, WIPO), le contrôle de `vercea.com` et le test de prononciation ne sont pas faits (`verification-marque-vercea.md`). Un domaine réservé ne protège rien contre une marque antérieure.
- **À l'achat** : compte dont vous contrôlez l'e-mail, double authentification, renouvellement automatique, protection des données personnelles, verrouillage du transfert.
- **Ne pas laisser expirer les anciens domaines** : les 301 en dépendent, pendant au moins un an.

## 2. Servir le nouveau domaine en parallèle, sans redirection
1. **DNS** : enregistrements A (et AAAA si le serveur a une adresse IPv6) de `vercea.app` et `www.vercea.app` vers l'adresse du serveur ; durée de vie (TTL) abaissée à 300 s avant le basculement.
2. **Caddy** : ajouter le bloc du nouveau domaine (proposition B de `caddyfile-propositions.md`) ; le certificat HTTPS est obtenu automatiquement dès que le DNS pointe. `.app` impose HTTPS : déjà le cas.
3. **`APP_URL=https://vercea.app`** dans `.env` : cette variable alimente les liens des e-mails (validation client, rapports, invitations), le plan du site, `robots.txt` et les balises canoniques. À changer **en dernier**, après les points 4 et 5.
4. **Services externes à mettre à jour (garder l'ancienne adresse tant que la bascule n'est pas finie)** :
   - LinkedIn : ajouter la nouvelle adresse de retour OAuth (`/api/linkedin/...`) dans l'application développeur ; **`/privacy-policy` reste à son adresse déclarée jusqu'à ce que la déclaration soit changée** ;
   - Stripe : ajouter un second point de terminaison de webhook sur le nouveau domaine, puis retirer l'ancien après la bascule ;
   - Instagram : `INSTAGRAM_REDIRECT_URI` ;
   - Umami et Search Console : propriété du nouveau domaine ;
   - E-mail : enregistrements SPF, DKIM et DMARC du nouveau domaine ; `SMTP_FROM` et `CONTACT_EMAIL` ; **ne pas supprimer la boîte actuelle** (neuf occurrences de `contact@linkeepost.app` dans le code, plus les anciens e-mails déjà envoyés).
5. **Vérifier** : `SMOKE_URL=https://vercea.app ./scripts/smoke.sh` et `scripts/check-redirects.sh` (voir ci-dessous).

## 3. Les 301 de domaine (après les étapes 1 et 2, et après le renommage du site)
**À ne faire que lorsque le site affiche le nouveau nom.** Une redirection vers `vercea.app` pendant que le site s'appelle encore LinkeePost désoriente les visiteurs et mélange les signaux de référencement. La marque du site se change à un seul endroit (`lib/brand.js`).

Règles (proposition C de `caddyfile-propositions.md`) :
- **Pages (GET, HEAD)** : 301 vers le même chemin et la même requête sur le nouveau domaine. Les liens à jeton (`/valider/…`, `/rapport/…`, `/reset-password?…`, `/oauth/authorize`) continuent donc de fonctionner.
- **Autres méthodes (POST…)** : **pas de redirection** pendant la transition. Une 301 transforme souvent un POST en GET : webhooks et appels d'API cassés. Ces requêtes restent servies par l'ancien domaine jusqu'à ce que les services externes aient la nouvelle adresse.
- **`linkeepost.app`** : ne redirige que si son DNS pointe vers votre serveur (certificat HTTPS impossible sinon). Sinon, la redirection est à faire chez le registraire (redirection web du domaine).
- **Sessions** : les cookies sont propres à chaque domaine : les utilisateurs connectés devront se reconnecter une fois.

## 4. Les 301 de chemins (après la mise en ligne des nouvelles pages)
Pas avant : une redirection vers une page qui n'existe pas est pire qu'aucune. Table prévue (`inventaire-site-public.md`, section 7) : `/fonctionnalites` et `/comment-ca-marche` vers `/produit`, `/mentions-legales`, `/cgu` et `/confidentialite` vers `/legal` (ancres), `/demo-editoriale` vers `/preuves/demo` quand elle existe. **Jamais** : `/privacy-policy`, `/privacy`, `/securite`, les adresses à jeton et `/api/*`. Ces redirections se feront dans `next.config.mjs` (statut 308, équivalent de 301 pour le référencement et fidèle à la méthode).

## 5. Après la bascule
- Contrôler avec `scripts/check-redirects.sh` : statut 301, adresse cible et chemin conservés.
- Search Console : « changement d'adresse » (les deux propriétés doivent être validées), puis dépôt du nouveau plan du site.
- Garder les 301 au moins un an ; ne pas laisser expirer les anciens domaines.
- **Retour arrière** : remettre l'ancien `Caddyfile` et `APP_URL`, puis recharger Caddy. Les anciennes adresses fonctionnent tant que vous n'avez pas coupé leur service.
