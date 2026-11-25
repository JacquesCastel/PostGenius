# Avancement du portage des maquettes dans le code (11 novembre 2026)

Tout est sur la branche `claude/funny-goodall-f2dvgs`, **non déployé**. Le build (`next build`) passe ; contact et bêta ont été vérifiés à l'écran (ordinateur et téléphone) ; le blog n'a pas pu l'être (il lit la base).

## Fait (tranche 1)
- **Fondations** : `lib/brand.js` (nom affiché, **LinkeePost tant que « Vercéa » n'est pas validé** : un seul endroit à changer), polices locales Fraunces et DM Sans (`@fontsource`), styles `.font-display`, `.prose-v2` dans `app/globals.css`, gabarit `components/v2/Shell.js`.
- **En-tête et pied de page** : variante `v2` de `SiteHeader` et `SiteFooter` (la logique de session, la redirection du tableau de bord et la fenêtre d'au revoir sont inchangées). Navigation v2 limitée aux pages qui existent.
- **Pages restylées** : `/contact`, `/beta`, `/blog`, `/blog/[slug]`. Textes inchangés, mêmes données.

## Fait (tranche 2) : `/preuves` et `/preuves/test-e4`
- Pages portées depuis les maquettes, **fermées par défaut** : 404 tant que `SITE_PREUVES=1` n'est pas posé dans `.env` du serveur (`lib/sitePreuves.js`). Fusionner et déployer ne publie donc rien ; l'ouverture est un geste volontaire, à faire après la liste « À vérifier avant publication » du compte rendu E4.
- Données dans `lib/e4Page.js` ; `scripts/preuves-e4.test.mjs` vérifie que chaque chiffre, chaque formule et chaque adresse figurent dans `docs/e4-chiffres/compte-rendu/compte-rendu-E4.md`.
- Pas dans le plan du site, ni l'en-tête, ni le pied de page (à brancher à l'ouverture).
- Liens vers `/produit/methode` et `/produit/verification` retirés : ces pages n'existent pas encore.

## Pas encore fait
- Pages nouvelles : `/produit`, `/produit/methode`, `/produit/verification`, `/preuves`, `/preuves/test-e4`, `/a-propos`, `/legal` (avec redirections permanentes).
- Pages à restyler : `/`, `/tarifs`, `/scoring`, `/fonctionnalites`, `/comment-ca-marche`.
- Navigation finale (Produit, Preuves, Tarifs, Blog, À propos) : à brancher quand ces pages existent.

## Conditions avant mise en ligne
Ne pas déployer cette tranche seule : les pages restylées auraient un en-tête différent des autres. Les pages `/a-propos`, `/legal` et `/preuves/test-e4` ne doivent pas être publiées avec des champs à compléter ni avant la décision sur le compte rendu E4.
