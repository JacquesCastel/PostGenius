# Changement de nom affiché : LinkeePost → Vercéa (lot 1)

**Statut : prêt, non fusionné.** À fusionner le jour où vous décidez d'afficher « Vercéa ». Le nom a été vérifié en France (INPI, TMview, domaines) ; ce n'est pas une protection, seul un dépôt de marque en est une (voir `verification-marque-vercea.md`).

## Ce que ce lot change (dans le code)
- `lib/brand.js` : `BRAND_NAME = "Vercéa"`. Les pages du nouveau style (en-tête, pied de page, contact, bêta, blog, preuves, produit, tarifs, scoring, accueil, à propos, légal) l'utilisent ; le logo « V » et le « é » rose s'activent (`components/v2/BrandMark.js`).
- Tous les textes visibles de l'application et du site : accueil actuelle, fonctionnalités, tableau de bord, écran de partage, assistant de chat, écran d'autorisation des assistants IA, manifeste (nom de l'application installée), titres de pages, partage sur les réseaux (`siteName`), données structurées, e-mails (invitations, équipe, cycle de vie, relances, administration, bandeau et pied de page), serveur MCP (instructions affichées aux assistants).
- Les pages de preuve citent le test E4 sous son nom de l'époque (« LinkeePost (aujourd'hui Vercéa) ») : `NOM_DU_TEST` dans `lib/e4Page.js`.

## Ce que ce lot ne change pas, et pourquoi
| Élément | Raison | Quand |
|---|---|---|
| Domaine `linkeepost.app`, adresses `contact@linkeepost.app` | lot séparé (achat, DNS, Caddy, e-mail, 301) | `migration-domaine-301.md` |
| `/privacy-policy` (anglais) | adresse déclarée à LinkedIn ; son texte cite le nom : à changer **avec** le nom de l'application LinkedIn | en même temps que l'application LinkedIn |
| Fichiers gelés de la démo (`lib/gating.js` : message « Votre essai gratuit est terminé… utiliser LinkeePost », `lib/knowledge.js`, `lib/demoEditorialCore.mjs`, protocole) | les empreintes publiées interdisent de les modifier | tant que le gel court |
| `User-Agent: LinkeePost/1.0` des téléchargements (veille, pages, analyses) | identifiant technique que des sites peuvent avoir autorisé | à décider avec le domaine |
| Textes saisis en administration (pages légales, contenu de l'accueil actuelle, FAQ, articles de blog, offres) | ils sont en base : le code ne les modifie pas ; les valeurs par défaut du code sont renommées | à relire en administration |
| Documents historiques (`docs/e4-chiffres`, `docs/demo-editoriale`), scripts de publication d'articles | ils décrivent un état passé | jamais |
| Logo « LP » (pastille de l'application, des e-mails et des pages de l'ancien style) | l'identité visuelle de l'application est un chantier de design séparé | à décider |

## À faire hors du code, le jour J
1. **LinkedIn** : nom de l'application dans le portail développeur (écran de consentement des utilisateurs), puis `/privacy-policy` (texte anglais).
2. **Stripe** : nom des produits et de l'entreprise (reçus et factures).
3. **E-mail** : `SMTP_FROM` (nom d'expéditeur affiché) dans le `.env` du serveur.
4. **Administration** : relire les pages légales, l'accueil, la FAQ et les articles de blog qui citent encore l'ancien nom.
5. **Assistants IA** : le nom du serveur MCP déjà configuré chez des utilisateurs ne change pas (identifiant technique) ; seul le texte d'instructions change.

## Contrôles après déploiement
- Titre des onglets, en-tête, pied de page : « Vercéa ». Application installée (manifeste) : « Vercéa ».
- Un e-mail de test (invitation, administration > e-mails de test) : objet, bandeau et pied de page en « Vercéa », accent correctement affiché.
- `/preuves/test-e4` : la mention « Au moment du test, le produit s'appelait LinkeePost ».
- `/privacy-policy` : inchangée (200).
- Retour arrière : `./rollback.sh`, ou remettre `BRAND_NAME` et relancer la même substitution inverse.
