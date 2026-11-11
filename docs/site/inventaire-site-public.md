# Inventaire du site public, avant refonte de l'arborescence (11 novembre 2026)

**Aucune page n'a été modifiée, déplacée ni supprimée.** Ce document liste l'existant et propose un sort pour chaque page ; rien ne se fait avant validation de la liste par Jacques.

**Niveau de lecture, dit honnêtement.** Lus en entier : `/scoring`, `/securite` (et son contenu, dans `lib/footer-pages.js`), la logique de `/privacy` et de `lib/access.js`. Lus par sections, titres et recherche de mots à risque (viral, garanti, jamais, portée, copilote, inventé…) : l'accueil, `/fonctionnalites` (747 lignes), `/comment-ca-marche` (186), `/tarifs`, `/beta`, `/contact`, `/motion`. Non lus en entier : le détail de ces pages, `/privacy-policy`, le contenu **en base** des pages légales et du blog (le dépôt n'en contient que les valeurs par défaut).

## 1. Les pages publiques

| URL | Source du contenu | Ce que c'est | Constats | Sort proposé |
|---|---|---|---|---|
| `/` | `app/page.js` | Accueil : de l'idée au contact, « D'où vient chaque post », outils autour du texte, comment ça marche, tarifs, FAQ, CTA | Hero à réécrire ; « Copilote éditorial » est un nom de fonction | **Réécrire en dernier**, avec les seules preuves qui existent |
| `/fonctionnalites` | `app/fonctionnalites/page.js` (747 l.) | 20 sections : ADN, matière, dictée, copilote, génération, contrôle de forme, campagnes, veille, visuels, vidéo, leads, mesure, coach, validation client, assistants IA, équipe, événements… | Ton prudent et précis (« il ne dit rien plutôt que d'inventer »), niveaux d'offre indiqués | **Déplacer vers `/produit`**, en découpant ; redirection permanente |
| `/comment-ca-marche` | `app/comment-ca-marche/page.js` | Parcours en 9 étapes (de l'inscription au suivi des résultats) | C'est le parcours complet, pas seulement les sources | **Déplacer** vers `/produit` (parcours) ; `/produit/sources` n'en couvrirait qu'une partie |
| `/scoring` | `app/scoring/page.js` (215 l.) | « Le contrôle de forme » : 7 critères, poids, niveaux de note | **Voir la décision 1** | **Garder, sous `/produit`, avec corrections de texte** |
| `/securite` | `lib/footer-pages.js` (+ base) | Page de sécurité détaillée | **Voir la décision 2** : ce n'est pas une page vide | **Garder** |
| `/tarifs` | `app/tarifs/page.js`, `lib/plans.js` | Trois offres : Essentiel 19 €, Pro 49 €, Agence 129 € | Le brief parle d'un ou deux plans : **décision commerciale**, liée à Stripe | **Garder** ; retouche de libellés seulement, sauf décision |
| `/blog`, `/blog/[slug]` | base (`Article`) | Articles | 11 articles préparés dans `outputs/` ; lesquels sont publiés : **inconnu depuis le dépôt**. Deux titres à risque : « …sans rien inventer » (n°7) et « …va marcher, avant de le publier ? » (score d'engagement) | **Garder** ; auditer les titres |
| `/contact` | `app/contact/page.js` | Formulaire et motifs de contact | Adresse `contact@linkeepost.app` (voir T1) | **Garder** |
| `/beta` | `app/beta/page.js` | Bêta fermée : ce que vous recevez, comment ça se passe | **Absent de l'arborescence cible**, alors que c'est la cible de tous les boutons d'inscription tant que `ACCESS_MODE = "beta"` | **Garder** (à ajouter au plan) |
| `/mentions-legales`, `/cgu`, `/confidentialite` | `lib/footer-pages.js` + base | Pages légales en français, éditables depuis l'administration | Trois marqueurs « À COMPLÉTER » dans les valeurs par défaut (raison sociale, forme juridique, ville du tribunal) : voir T4 | **Regrouper sous `/legal`**, avec redirections, après vérification du contenu en base |
| `/privacy-policy` | `app/privacy-policy/page.js` (62 l.) | Politique de confidentialité **en anglais**, codée en dur | Lien du pied de page | **Ne pas toucher avant vérification** (décision 3) |
| `/privacy` | `app/privacy/page.js` (6 l.) | **Redirection** vers `/privacy-policy` | Pas un doublon de contenu : un alias | **Garder l'alias** (décision 3) |
| `/motion` | `app/motion/page.js` (18 l.) | « LinkeePost en 40 secondes », animation de marque | Non lié dans la navigation ; textes déjà assouplis (commit « Chiffres à vérifier signalés ») | À lire avant décision |
| `/demo-editoriale` | `app/demo-editoriale/` | Démonstration éditoriale | Non indexée, non liée, **aucun texte authentique** | **Rediriger plus tard**, quand `/preuves/demo` existe |

## 2. Pages fonctionnelles : ne pas toucher, jamais casser

`/oauth/authorize` (écran d'autorisation des assistants connectés), `/reset-password`, `/valider/[token]` (validation client), `/rapport/[token]` (rapport client), `/app` et tout `/app/*` (espace connecté), `/api/*`. Les liens à jeton ont déjà été envoyés par e-mail : leurs adresses doivent rester valides indéfiniment.

## 3. Constats transversaux

- **T1. Domaine : le dépôt et la réalité divergent.** Le `Caddyfile`, `deploy.sh`, `.env.example`, la valeur par défaut du plan du site et neuf adresses `contact@linkeepost.app` supposent que **`linkeepost.app` est l'adresse principale** et que `postgenius.network` redirige vers elle. Vos constats du 10 novembre sont l'inverse : `linkeepost.app` ne mène pas à votre serveur, et le site répond sur `postgenius.network`. Conséquences possibles à vérifier : adresses canoniques et plan du site pointant vers un nom qui ne répond pas, **e-mails de contact et d'envoi sur un domaine dont la messagerie n'est peut-être pas configurée**. À vérifier sur le serveur : `docker exec postgenius-app-1 printenv APP_URL`, le `Caddyfile` réellement chargé, et les enregistrements MX de `linkeepost.app`. **Aucun travail de référencement avant cette vérification.**
- **T2. Deux modes d'accès.** `lib/access.js` : `ACCESS_MODE = "beta"` ; tous les textes publics passent par `pick(beta, open)`. La refonte doit respecter ce mécanisme.
- **T3. Trois noms pour une même fonction.** Page publique, pied de page et libellés d'offres : « Contrôle de forme ». Code, message de blocage de l'API, article de blog : « score d'engagement », « potentiel d'engagement ». Le blog promet « savez-vous si votre post va marcher » alors que le corps de l'article et la page `/scoring` disent le contraire.
- **T4. Pages légales avec marqueurs « À COMPLÉTER »** dans les valeurs par défaut. Si la base contient les mêmes textes, ils sont publiés tels quels. Les mentions légales doivent être complètes : **à vérifier en production avant toute refonte**.
- **T5. Contenu en base.** Pages légales, sécurité et blog sont éditables depuis l'administration (`SiteContent`, `Article`) : le dépôt ne donne que les valeurs par défaut. Pour lister le réel, une lecture seule suffit (à exécuter par Jacques, sans coller de secret) : `SELECT slug, title, published FROM "Article" ORDER BY "createdAt";` et `SELECT key, length(value) FROM "SiteContent" WHERE key LIKE 'page-%';`.
- **T6. « Copilote ».** Nom de fonction très présent (accueil, fonctionnalités, parcours, animation). La recommandation marketing déconseille le mot **dans la promesse** ; renommer la fonction est une décision produit distincte.

## 4. Les décisions

### Décision 1 : `/scoring`
**Constat (corrige une hypothèse du brief).** Ce n'est **pas** un score de viralité. La page présente un contrôle de forme à **règles fixes** (même texte, même note), avec sept critères, et dit elle-même : « un indicateur de qualité, pas une boule de cristal », « elle ne prédit pas un nombre de vues ou de likes ». **Ses chiffres sont exacts** : poids 25, 25, 10, 10, 10, 10, 10 ; longueur 400 à 1 600 caractères ; 5 hashtags au plus ; 6 émojis au plus (`lib/score.js` et `lib/linkedinRules.js`). Le code le qualifie en en-tête de « potentiel d'engagement » mais précise « ce n'est PAS une prédiction ».
**À corriger dans le texte** : « C'est un copilote qui vous évite les erreurs classiques et vous **pousse vers vos meilleurs posts** » (laisse entendre un résultat) ; le bouton « **Faites grimper le score** de votre prochain post » (gamification de la note) ; la jauge « 82 / Excellent » présentée comme une capture sans mention d'**exemple illustratif** (le brief demande de montrer le parcours, pas des captures fantaisistes).
**Recommandation** : ne pas supprimer, **déplacer** sous `/produit` (par exemple `/produit/controle-de-forme`), corriger ces trois passages, et trancher le nom unique de la fonction (T3), ainsi que le titre de l'article de blog.

### Décision 2 : `/securite`
**Constat (corrige une première impression).** Les 31 lignes du fichier ne sont que le gabarit : le contenu est dans `lib/footer-pages.js`. Il est **dense, concret et vérifiable** : hébergement (Hetzner, Allemagne ; base Neon, Francfort), chiffrement des jetons (AES-256), hachage des mots de passe (bcrypt), durées de conservation (24 à 48 heures, 30 jours), accès en lecture seule pour le support (2 heures), sous-traitants nommés, sauvegardes, et une section **« Ce que nous n'avons pas »** (pas de SOC 2 ni de certification ISO 27001). C'est exactement le type de page que la règle « pas de page sans contenu vérifiable » veut garder : elle la satisfait, et elle sert le positionnement.
**Recommandation** : **ne pas supprimer**. La conserver (sous `/produit/securite` ou à sa place actuelle) et ajouter à la liste de vérification que chaque affirmation chiffrée soit contrôlée dans le code, comme pour E4. Le contenu en base peut différer des valeurs par défaut : le lire avant de décider de la déplacer.

### Décision 3 : pages de confidentialité
**Constat.** Il n'y a pas de doublon de contenu : `/privacy` est une **redirection** vers `/privacy-policy`, qui est une politique **en anglais**, en plus de `/confidentialite` en français. Ce sont donc deux politiques, dans deux langues, qui peuvent diverger. `/privacy-policy` est lié dans le pied de page, et l'adresse est probablement déclarée chez des tiers (applications LinkedIn, Stripe, consentements) : le dépôt ne le dit pas.
**Recommandation** : conserver ces trois adresses fonctionnelles. Les regrouper sous `/legal` avec des **redirections permanentes**, mais seulement après avoir vérifié où `/privacy-policy` et `/privacy` sont déclarés, et rapproché le texte anglais du texte français.

### Décision 4 : inventaire complet
C'est ce document. Il reste à lire en entier, avant tout déplacement : le détail de `/fonctionnalites` et de l'accueil, `/privacy-policy`, `/motion`, et surtout le **contenu réel en base** (T5).

## 5. Redirections à prévoir si l'arborescence est adoptée (propositions)

| Ancienne adresse | Nouvelle adresse | Quand |
|---|---|---|
| `/fonctionnalites` | `/produit` | avec la page produit |
| `/comment-ca-marche` | `/produit` (parcours) | avec la page produit |
| `/scoring` | `/produit/controle-de-forme` | avec la page produit |
| `/securite` | `/produit/securite` ou inchangée | décision 2 |
| `/mentions-legales`, `/cgu`, `/confidentialite` | `/legal` (ancres) | après vérification de la base |
| `/privacy-policy`, `/privacy` | inchangées tant que non vérifiées | décision 3 |
| `/demo-editoriale` | `/preuves/demo` | **seulement** quand la page existe |

Toutes en redirection **permanente** (308). Le plan du site (`app/sitemap.js`) et les liens du pied de page sont à mettre à jour dans le même changement.

## 6. Ce que je n'ai pas pu vérifier
La production (réseau de la session restreint) : valeur de `APP_URL`, Caddyfile chargé, MX de `linkeepost.app`, contenu réel des pages en base, articles publiés, déclarations de `/privacy-policy` chez des tiers. Les chiffres de `/securite` et de `/fonctionnalites` ne sont pas recontrôlés dans le code.
