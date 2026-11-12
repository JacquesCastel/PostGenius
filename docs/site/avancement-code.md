# Avancement du portage des maquettes dans le code (11 novembre 2026)

Tout est sur la branche `claude/funny-goodall-f2dvgs`, **non déployé**. Le build (`next build`) passe ; contact et bêta ont été vérifiés à l'écran (ordinateur et téléphone) ; le blog n'a pas pu l'être (il lit la base).

## Fait (tranche 1)
- **Fondations** : `lib/brand.js` (nom affiché, **LinkeePost tant que « Vercéa » n'est pas validé** : un seul endroit à changer), polices locales Fraunces et DM Sans (`@fontsource`), styles `.font-display`, `.prose-v2` dans `app/globals.css`, gabarit `components/v2/Shell.js`.
- **En-tête et pied de page** : variante `v2` de `SiteHeader` et `SiteFooter` (la logique de session, la redirection du tableau de bord et la fenêtre d'au revoir sont inchangées). Navigation v2 limitée aux pages qui existent.
- **Pages restylées** : `/contact`, `/beta`, `/blog`, `/blog/[slug]`. Textes inchangés, mêmes données.

## Pas encore fait
- Pages nouvelles : `/produit`, `/produit/methode`, `/produit/verification`, `/preuves`, `/preuves/test-e4`, `/a-propos`, `/legal` (avec redirections permanentes).
- Pages à restyler : `/`, `/tarifs`, `/scoring`, `/fonctionnalites`, `/comment-ca-marche`.
- Navigation finale (Produit, Preuves, Tarifs, Blog, À propos) : à brancher quand ces pages existent.

## Conditions avant mise en ligne
Ne pas déployer cette tranche seule : les pages restylées auraient un en-tête différent des autres. Les pages `/a-propos`, `/legal` et `/preuves/test-e4` ne doivent pas être publiées avec des champs à compléter ni avant la décision sur le compte rendu E4.
