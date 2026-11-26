# Ouvrir les pages du nouveau site : mode d'emploi

Chaque page du nouveau site est fermée (404) tant que son interrupteur n'est pas posé dans le `.env` du serveur (`/opt/postgenius/.env`).
Les interrupteurs sont lus **à chaque requête** : aucun rebuild, seulement un redémarrage du conteneur pour relire le `.env` :

```bash
cd /opt/postgenius && docker compose up -d --force-recreate app
```

Pour fermer à nouveau : retirer la ligne du `.env`, puis relancer la commande.

## Les interrupteurs

| Interrupteur | Ce qu'il ouvre | Condition en plus (sinon la page reste en 404) | État au 26/11/2026 |
|---|---|---|---|
| `SITE_PRODUIT=1` | `/produit`, `/produit/methode`, `/produit/verification` | aucune | **ouvert** |
| `SITE_PREUVES=1` | `/preuves`, `/preuves/test-e4` | décisions sur le compte rendu E4 (voir ci-dessous) | fermé |
| `SITE_ACCUEIL=1` | nouvelle accueil à la place de l'ancienne | décision sur les blocs retirés (fonctions, offres, FAQ) | fermé |
| `SITE_APROPOS=1` | `/a-propos` | tous les champs de `lib/aPropos.js` remplis | fermé, champs vides |
| `SITE_LEGAL=1` | `/legal` | plus aucun « À COMPLÉTER » dans les trois textes légaux (administration) | fermé, champs à compléter |
| `SITE_REDIRECTIONS=1` | redirections permanentes de l'ancien site (`lib/redirections.js`) | la page de destination est ouverte | fermé |

Les liens de l'en-tête, du pied de page et du plan du site suivent automatiquement : un lien n'existe que si sa page est ouverte.

## Ordre conseillé
1. **`SITE_PRODUIT`** (fait). Les étiquettes « En test auprès de comptes sélectionnés » (`lib/produitMethode.js`, `ETAT_TEST`) décrivent le compagnon éditorial réservé à des comptes sélectionnés : à retirer quand il s'ouvre à tous.
2. **`SITE_PREUVES`**, après le compte rendu E4 (`docs/e4-chiffres/compte-rendu/compte-rendu-E4.md`, section « À vérifier avant publication ») :
   - ~~révoquer les clés de test OpenAI et Anthropic, supprimer le `.env` de test du serveur~~ : fait, noté au journal le 26 novembre 2026 ;
   - relire les formules de conclusion : « l'écart vient de l'invite » ne vaut que pour ces dix sujets fictifs, une génération par cas ;
   - le dépôt est public (vérifié le 26/11/2026), donc les liens vers l'annexe et la grille fonctionnent ;
   - si un texte cite l'étude Vectara ou le cas de la Cour suprême du Nouveau-Mexique : ajouter la mention du protocole.
   Ouvrir `/preuves` fait aussi apparaître la carte de preuve de la nouvelle accueil, le lien « Voir la preuve », le lien du test dans la FAQ de `/a-propos`.
3. **`SITE_APROPOS`** et **`SITE_LEGAL`**, après avoir donné les informations de l'éditeur (raison sociale, forme juridique, ville du siège, SIREN, adresse, TVA, directeur de la publication ; paragraphe « pourquoi », portrait, engagement de correction).
4. **`SITE_ACCUEIL`**, après décision sur les blocs de l'ancienne accueil absents de la maquette.
5. **`SITE_REDIRECTIONS`**, en dernier, quand les pages de destination sont ouvertes et relues : `/fonctionnalites` → `/produit`, `/comment-ca-marche` → `/produit/methode`, `/mentions-legales`, `/cgu`, `/confidentialite` → `/legal`. **`/privacy-policy` et `/privacy` ne sont jamais redirigées** (adresse déclarée à LinkedIn).

## Contrôles après chaque ouverture
- La page répond 200 ; sur téléphone, aucun défilement horizontal.
- L'en-tête et le pied de page affichent le lien de la page ouverte et aucun lien vers une page fermée.
- `sitemap.xml` contient la page.
- Fermer l'interrupteur la remet en 404 et retire ses liens.
- Après `SITE_REDIRECTIONS` : `curl -sI https://<site>/fonctionnalites` renvoie 308 vers `/produit` ; `curl -sI https://<site>/privacy-policy` renvoie 200.

## Hors de ce mode d'emploi
Le changement de nom (LinkeePost → Vercéa) est un lot séparé : nom affiché (`lib/brand.js`), puis domaine, boîte mail, adresses de retour LinkedIn et Instagram, Stripe. Voir `docs/site/migration-domaine-301.md` et `docs/site/verification-marque-vercea.md`.
