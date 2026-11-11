# Inventaire du site public, avant refonte de l'arborescence (11 novembre 2026, version 2)

**Aucune page n'a été modifiée, déplacée ni supprimée.** Ce document liste l'existant et propose un sort pour chaque page ; rien ne se fait avant validation par Jacques.

**Niveau de lecture, dit honnêtement.** Lus **en entier** : l'accueil (`app/page.js`, 474 lignes), `/fonctionnalites` (747 lignes), `/privacy-policy`, `/scoring`, `/securite` (et son contenu dans `lib/footer-pages.js`), `/privacy`, `lib/access.js`, `lib/markdown.js`. Chiffres des offres recontrôlés dans `lib/plans.js`. Lus **par sections seulement** : `/comment-ca-marche` (186 lignes), `/tarifs`, `/beta`, `/contact`, `/motion`. **Non lisibles depuis le dépôt** : le contenu en base (pages légales, sécurité, blog) et la production.

## 1. Les quatre décisions de Jacques (actées)

1. **`/scoring`** : garder, déplacer, corriger. Nom unique retenu : **« Chiffres à vérifier »**… avec la correction ci-dessous (point 4 de la section 3) : ce nom désigne **une autre fonction** que la page `/scoring`.
2. **`/securite`** : garder.
3. **Confidentialité** : d'abord repérer les déclarations chez des tiers, puis regrouper sous `/legal` avec redirections permanentes, sans jamais toucher une adresse déclarée.
4. **`/beta`** : ajoutée à l'arborescence.

Arborescence cible : `/`, `/produit` (+2 sous-pages), `/preuves` (+`test-e4`, `demo` à venir), `/scoring` (déplacée, renommée), `/blog`, `/tarifs`, `/beta`, `/a-propos`, `/contact`, `/legal`.

Ordre de travail validé : `/preuves/test-e4` (E4 seulement) → `/produit` → accueil en dernier (seulement des cartes de preuve réelles) → `/a-propos` → redirection de `/demo-editoriale` seulement quand `/preuves/demo` existe. Vercéa : une note minimale, aucun code. Vérifier `APP_URL` avant tout travail de référencement.

## 2. Les pages publiques

| URL | Source | Ce que c'est | Constats | Sort proposé |
|---|---|---|---|---|
| `/` | `app/page.js` | Accueil : hero, animation, bandeau de 4 chiffres, 3 piliers, « D'où vient chaque post », outils, contrôle de forme, parcours, tarifs, FAQ (en base), CTA | Voir section 4 | **Réécrire en dernier** |
| `/fonctionnalites` | `app/fonctionnalites/page.js` | 20 sections détaillées | Ton prudent et précis ; deux phrases absolues à vérifier (section 4) | **Déplacer vers `/produit`**, en découpant ; 308 |
| `/comment-ca-marche` | `app/comment-ca-marche/page.js` | Parcours en 9 étapes | Parcours complet, pas seulement les sources | **Déplacer** vers `/produit` |
| `/scoring` | `app/scoring/page.js` | « Le contrôle de forme » : 7 critères | Voir section 3 | **Garder, déplacer, corriger** |
| `/securite` | `lib/footer-pages.js` (+ base) | Sécurité détaillée | Contenu dense et vérifiable | **Garder** |
| `/tarifs` | `app/tarifs/page.js`, `lib/plans.js` | Essentiel 19 €, Pro 49 €, Agence 129 € | Le brief parle de 1 à 2 plans : décision commerciale liée à Stripe | **Garder** |
| `/blog`, `/blog/[slug]` | base (`Article`) | Articles | Lesquels sont publiés : inconnu ; deux titres à risque (n°7 « …sans rien inventer » ; « …va marcher, avant de le publier ? ») | **Garder**, auditer les titres |
| `/contact` | `app/contact/page.js` | Formulaire | Adresse `contact@linkeepost.app` (T1) | **Garder** |
| `/beta` | `app/beta/page.js` | Bêta fermée | Cible de tous les boutons d'inscription tant que `ACCESS_MODE = "beta"` | **Garder** |
| `/mentions-legales`, `/cgu`, `/confidentialite` | `lib/footer-pages.js` + base | Légal en français, éditable en base | Trois marqueurs « À COMPLÉTER » (T4) | **Regrouper sous `/legal`** après vérification de la base |
| `/privacy-policy` | `app/privacy-policy/page.js` | Politique **en anglais**, codée en dur | **Adresse déclarée à LinkedIn** (commentaire du code). Voir section 5 | **Ne jamais déplacer ni rediriger** |
| `/privacy` | `app/privacy/page.js` | Redirection vers `/privacy-policy` | Alias | **Garder** |
| `/motion` | `app/motion/page.js` | Animation de marque | Non liée | À décider |
| `/demo-editoriale` | `app/demo-editoriale/` | Démonstration | Non indexée, aucun texte authentique | **Rediriger plus tard** |

## 3. Correction importante : deux fonctions, deux noms

Le dépôt contient **deux fonctions distinctes**, que « Chiffres à vérifier » et « Contrôle de forme » ne doivent pas confondre :

| | Contrôle de forme | Chiffres à vérifier |
|---|---|---|
| Code | `lib/score.js`, `lib/linkedinRules.js` | `lib/figureCheck.js` |
| Ce qu'il fait | Note sur 100, 7 critères fixes (accroche, longueur, aération, hashtags, émojis, appel à l'action…), déterministe | Signale, sous le post, les chiffres **absents des informations fournies** |
| Page publique | `/scoring` | **aucune** (une phrase dans `/fonctionnalites`, « Votre matière ») |
| Lien avec E4 | aucun | **c'est la fonction que le test E4 éclaire** |

**Recommandation.** Garder « **Contrôle de forme** » pour la page `/scoring` (c'est déjà son nom public) et réserver « **Chiffres à vérifier** » à une page distincte, `/produit/chiffres-a-verifier`, qui décrit ce que fait réellement `figureCheck.js` (indicatif, ne remplace pas la relecture). Si Jacques préfère le nom unique pour le score, il faut alors renommer la page score **et** créer l'autre page sous un autre nom : le même nom ne peut pas désigner les deux.

**Corrections de texte de `/scoring`** (chiffres exacts : poids 25/25/10/10/10/10/10 ; 400 à 1 600 caractères ; 5 hashtags ; 6 émojis) : « un copilote… qui vous **pousse vers vos meilleurs posts** » (laisse entendre un résultat) ; bouton « **Faites grimper le score** » (gamification) ; jauge « 82 / Excellent » non signalée comme **exemple illustratif**.

**Page `/produit/verification` (si elle est prévue)** : elle ne doit décrire que ce qui existe. Il n'y a **pas d'empreintes de génération dans le produit** ; seul le contrôle des chiffres existe, et il est indicatif.

## 4. Lecture intégrale de l'accueil et de `/fonctionnalites` : ce qui est à reprendre

**Chiffres vérifiés dans le code (exacts)** : dictée 10 / 60 / 60 minutes par mois ; vidéo et audio 120 (Pro) et 300 par client (Agence) ; 5 utilisateurs et 25 clients (Agence) ; 9 langues ; 24 h / 48 h de conservation des données de commentateurs (cohérent avec `/privacy-policy`).

**À reprendre sur l'accueil**
- **Cartes flottantes du hero** : « Sources déposées **14** », « Sources utilisées **2 sur ce post** » : maquette présentée comme un état réel, sans mention « exemple ». Idem la campagne « Accessibilité 2026 », la jauge « 82 », et l'« inspiration du jour ». Règle du brief : **seulement des cartes de preuve réelles** → étiqueter « exemple » ou retirer.
- **Bandeau de 4 chiffres** : « **100 %** API officielle LinkedIn » est une affirmation sur la conformité, que le brief interdit de promettre ; « 0 € sans carte bancaire » et « 9 langues » sont factuels.
- **Hero** à réécrire selon la formule validée : « les chiffres absents de vos documents sont signalés avant publication ».
- **« Ce qui nous distingue / D'où vient chaque post »** : « Un générateur ordinaire repart de zéro à chaque fois » compare à une catégorie sans la nommer ; acceptable, mais c'est une affirmation non étayée par une preuve publique.
- **Section contrôle de forme** : déjà prudente (« pas une prévision de vues ou de réactions »), mais jauge illustrative non étiquetée.
- **« Prêt à automatiser votre LinkedIn ? »**, **« Votre prochaine campagne commence aujourd'hui »** : promesse d'automatisation à garder bornée (rien ne se publie sans validation si elle est activée).
- **Tarifs** : `BETA ? "/beta" : "/app?plan=…"` ; textes `pick(...)` à conserver.

**À vérifier sur `/fonctionnalites`**
- « **Chaque chiffre repris doit se retrouver dans une source, citée dans le post** » et « chaque chiffre doit se retrouver dans le contenu d'origine » : formulation **absolue**. Le produit **signale** les chiffres absents ; il ne **garantit** pas. À reformuler : « les chiffres absents de vos documents sont signalés avant publication ».
- « **Il ne dit rien plutôt que d'inventer** » (coach) : exact pour le coach (seuil de 8 posts), mais le mot « inventer » ne doit pas déborder sur la génération de texte.
- « **Comment on calcule votre score** » (lien vers `/scoring`) : le mot « score » est le troisième nom de la fonction (T3).
- « **Claude, ChatGPT ou Cursor** » (assistants IA) : noms d'outils **partenaires d'intégration**, pas de concurrents ; la règle « aucun concurrent nommé » ne s'y applique pas, mais le dire dans la validation.
- « **Transcription par OpenAI** » : sous-traitant nommé ; à rapprocher de la liste de `/securite` et de `/privacy-policy`.
- « **Conformément aux règles de LinkedIn** » (leads) : renvoie à la conformité LinkedIn ; à relire avec la règle « ne rien promettre sur LinkedIn ».
- Maquettes : « 18/30 sources », « Confiance 88 », « 2,5× votre médiane », « +40 % de candidatures », « 6 à 4 semaines » : toutes illustratives, aucune n'est étiquetée.

## 5. `/privacy-policy` : lu en entier

- C'est la politique **anglaise**, codée en dur ; le commentaire du code précise que c'est **l'adresse donnée à LinkedIn** pour l'application développeur. **Elle ne bouge pas et ne se redirige pas.**
- Le bloc « Data controller and contact » est lu dans la section 0 de la version française (`confidentialite`). Si la base contient la valeur par défaut, il affiche **« [À COMPLÉTER : raison sociale] »**, en anglais, sur l'adresse déclarée à LinkedIn. **Priorité de vérification.**
- Sections détaillées et cohérentes avec `/securite` (conservation 24 h / 48 h, assistants IA, vidéo/audio, sous-traitants, Do-Not-Track, mineurs de moins de 16 ans).
- `/privacy` est un alias (`redirect`) : le garder.

## 6. Constats transversaux

- **T1. Domaine.** `Caddyfile`, `deploy.sh`, `.env.example`, valeur par défaut du plan du site et neuf adresses `contact@linkeepost.app` supposent que `linkeepost.app` est le domaine principal, avec `postgenius.network` redirigé. Vos constats du 10 novembre sont l'inverse. **Aucun travail de référencement avant résolution.**
- **T2. Deux modes d'accès** (`lib/access.js`, `ACCESS_MODE = "beta"`, `pick(beta, open)`). La refonte doit respecter ce mécanisme.
- **T3. Trois noms pour le score** : « Contrôle de forme » (public), « score d'engagement » (code, message d'API, article de blog), « note de forme » (maquettes).
- **T4. Légal avec marqueurs « À COMPLÉTER »** (raison sociale, forme juridique, ville du tribunal), éventuellement publiés tels quels.
- **T5. Contenu en base** (pages légales, sécurité, blog, FAQ et hero de l'accueil via `getLanding()`) : le dépôt ne donne que les valeurs par défaut. Une réécriture de l'accueil dans le code peut être **écrasée ou contredite par la base** : à vérifier avant de toucher le hero.
- **T6. « Copilote »** : nom de fonction, très présent ; le retirer de la promesse est un choix distinct du renommage.

## 7. Redirections proposées

| Ancienne adresse | Nouvelle adresse | Quand |
|---|---|---|
| `/fonctionnalites` | `/produit` | avec `/produit` |
| `/comment-ca-marche` | `/produit` | avec `/produit` |
| `/scoring` | `/produit/controle-de-forme` (ou nom retenu) | avec `/produit` |
| `/securite` | inchangée ou `/produit/securite` | décision 2 : garder |
| `/mentions-legales`, `/cgu`, `/confidentialite` | `/legal` (ancres) | après vérification de la base |
| `/privacy-policy`, `/privacy` | **inchangées** | jamais sans accord écrit |
| `/demo-editoriale` | `/preuves/demo` | seulement quand elle existe |

Toutes en 308. Plan du site (`app/sitemap.js`) et pied de page mis à jour dans le même changement. Les liens à jeton (`/valider/…`, `/rapport/…`, `/oauth/authorize`, `/reset-password`) ne changent jamais.

## 8. Vérifications à faire par Jacques sur le serveur (lecture seule, sans secret)

Je n'ai pas accès à la production (réseau de la session restreint). Commandes à lancer sur le serveur, puis coller seulement les résultats :

1. `docker exec postgenius-app-1 printenv APP_URL`
2. `docker exec postgenius-app-1 sh -c 'cat /etc/caddy/Caddyfile 2>/dev/null'` (ou `cat Caddyfile` dans le dossier du projet) : le fichier réellement chargé
3. `dig +short MX linkeepost.app`
4. En base : `SELECT slug, title, published FROM "Article" ORDER BY "createdAt";`
5. En base : `SELECT key, length(value) FROM "SiteContent" WHERE key LIKE 'page-%' OR key LIKE 'landing%';`
6. Dans les consoles tierces : où est déclaré `/privacy-policy` (LinkedIn certainement ; Stripe, autres) ?

## 9. Ce qui n'est pas vérifié

Production, contenu en base, articles publiés, déclarations chez des tiers, détail de `/comment-ca-marche`, `/tarifs`, `/beta`, `/contact`, `/motion`. Les chiffres de `/securite` ne sont pas recontrôlés dans le code.

## 10. Arborescence précisée par Jacques (11 novembre 2026)

| Adresse | Contenu | Règle |
|---|---|---|
| `/preuves` | uniquement l'externe et le vérifiable : test E4 (gists datés), démonstration éditoriale, résultats défavorables publiés, empreintes | une entrée n'existe que si sa page existe : **pas de carte « à venir »** |
| `/produit/methode` | comment le contenu est créé : documents → brouillon → signalement des chiffres absents → validation par l'auteur | décrit le parcours réel, étape par étape |
| `/produit/verification` | le contrôle interne : « Chiffres à vérifier », ce que les empreintes prouvent et ne prouvent pas | voir les trois précisions ci-dessous |

**Précisions à garder en tête**
1. **Le produit n'a pas d'empreintes.** Les empreintes (SHA-256) sont celles des **protocoles de test** (E4, démonstration), pas d'une fonction du produit. `/produit/verification` peut expliquer ce qu'une empreinte prouve (le texte n'a pas changé depuis la date de publication) et ne prouve pas (que le contenu est exact), mais doit décrire `lib/figureCheck.js` seul pour la fonction, et renvoyer vers `/preuves` pour les empreintes elles-mêmes.
2. **« Résultats défavorables publiés »** : la rubrique n'est remplie que de ce qui existe. Aucun résultat défavorable n'est déclaré ici tant qu'il n'est pas tiré du compte rendu publié.
3. **`/scoring` reste au premier niveau** (arborescence validée le 11 novembre), nommé « Contrôle de forme ». Les maquettes qui le plaçaient sous `/produit/controle-de-forme` sont à corriger : le lien pointe vers `/scoring`.

Redirections : celles de la section 7 restent valables, sauf `/scoring`, qui est renommée sans changer de niveau (redirection de l'ancienne adresse seulement si le chemin change).
