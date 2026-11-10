# Démonstration de l'intelligence éditoriale : analyse, méthode et compte rendu technique

Prototype isolé : **`/demo-editoriale`**. Un même sujet, trois profils (deux entreprises et un expert indépendant, tous fictifs), trois prises de parole, plus un témoin sans profil. Non indexé, non relié au site, aucun appel IA à la visite, aucune modification du moteur de génération.

> **Décisions du 10 novembre 2026, prises avant toute génération (point de transparence, pas une omission).**
> 1. **Wharf est exclu de la démonstration.** Wharf est la société de Jacques : le risque que cela soulève est levé par cette décision. Aucun texte de la démonstration n'a été généré avec Wharf ; il a été retiré du code et des documents de la démonstration avant la première génération. (Le profil Wharf a servi à des évaluations du moteur, hors démonstration : voir `docs/eval-editorial/`.)
> 2. **Un profil d'expert indépendant fictif est ajouté** (c'était le « 4e profil » de la décision, comptée avant l'exclusion de Wharf), Mathis Vauberlet (Vauberlet Conseil), consultant et formateur en cotation fonctionnelle. La démonstration compte donc **trois profils** (BELVANTE INDUSTRIE, CANTEVEL Conseil, Mathis Vauberlet) **et le témoin : quatre textes**. Le nom a été vérifié sans collision (`verification-noms-fictifs.md`).
> 3. Le protocole de test et ses seuils restent valides : l'appariement porte toujours sur trois profils (voir `protocole-test.md`).
> 4. **Trois noms fictifs ont été changés avant le gel**, après une vérification dans les registres d'entreprises (`verification-noms-fictifs.md`) : AXIOME Conseil (collision avec des entreprises réelles) est devenu **CANTEVEL Conseil** ; ASTER INDUSTRIE (proximité forte avec des entreprises réelles) est devenu **BELVANTE INDUSTRIE** ; Mathis Garlandier (le patronyme existe dans le registre) est devenu **Mathis Vauberlet**.
> 5. Les profils doivent être **figés avant la session de génération** (`gel-demo-empreintes.md`) : tout changement ultérieur invalide les empreintes.

> **État aujourd'hui : le prototype est fonctionnel, mais aucun exemple authentique n'a pu être généré.** Il n'y a pas de clé `ANTHROPIC_API_KEY` dans l'environnement où il a été construit. La page affiche donc, pour chaque entreprise, « Prise de parole en préparation », et **jamais** un texte inventé. Les textes que l'on voit dans les captures de développement sont des **données de test**, signalées comme telles à l'écran (bandeau et étiquette sur chaque texte). La procédure pour produire les vrais exemples est en §3.

**Règle d'affichage.** Rien n'est présenté comme « généré par le moteur », « sans modification », ni accompagné d'une date, d'un nombre de générations ou d'une empreinte, tant que l'exemple n'est pas **authentique** : enregistrement complet, empreinte recalculée à l'identique au chargement, **et** hors données de test (variable d'environnement de test, ou fichier qui se déclare « fixture »). Ces informations sont rangées dans une zone secondaire repliée. Les sorties du moteur (publications, « choix d'écriture » annoncés avec chaque texte) et les analyses faites après génération (lecture éditoriale humaine, relevé de mots) sont dans des zones distinctes et étiquetées.

## 1. Analyse préalable du dépôt

**Comment le moteur injecte une identité.** `app/api/generate/route.js` lit, pour l'utilisateur connecté, les champs de profil `headline`, `companyName`, `businessDescription`, `targetAudience`, `market`, `commGoals`, `editorialLine`, `styleNotes` (plus `brandVoice`, `postLanguage`, `styleExamples`) et les place dans le prompt (`buildUserPrompt`). Il y ajoute les sources de la base de connaissances (`knowledgeFor`), les remarques (`getRemarks`), la mémoire éditoriale (`memoryFor`), les éléments de langage (`elementsFor`) et les exemples de voix (`styleExamplesFor`). Il renvoie `text`, `extra`, `sources` et **`why`** (accroche, structure, fin, hashtags) : une explication de **choix d'écriture**, écrite dans la même génération.

**Réponses aux cinq questions.**

1. **Peut-on produire cette démonstration avec les mécanismes actuels ?** Oui pour la génération et l'injection du profil. **Limite importante : le moteur ne renvoie aucun champ « angle retenu ».** Il n'expose que des choix d'écriture (`why`). L'angle ne peut donc être montré que par une **lecture** des textes, étiquetée comme telle.
2. **Peut-on isoler complètement les trois contextes ?** Oui, **un compte de démonstration par entreprise** : toutes les lectures du moteur sont filtrées par `userId`. J'ai écarté l'alternative « trois thématiques d'un même compte » (`Context`), qui partage le profil de base, la mémoire et les remarques. **Preuve (test `th78`)** : sur huit appels, chaque conviction éditoriale n'apparaît que dans ses deux appels, jamais dans ceux d'une autre ; le témoin ne reçoit aucun profil.
3. **Comment garantir qu'un texte vient bien de LinkeePost ?** Le script appelle le **vrai** `POST /api/generate` (non modifié), en tant que compte de démonstration, et conserve l'**enregistrement complet** : requête, profil lu en base au moment de l'appel, contexte rapporté par `/api/generate/context`, réponse. Une **empreinte SHA-256** couvre l'ensemble. À la publication, puis à chaque chargement de la page, l'empreinte est recalculée : un texte retouché est **refusé** (la page affiche « indisponible »). **Limite honnête : ce n'est pas une signature infalsifiable.** Quelqu'un ayant accès au dépôt pourrait recalculer l'empreinte. La protection vaut contre l'erreur et la retouche, pas contre une fraude délibérée ; la preuve la plus solide reste l'historique Git et la conservation du fichier des candidats.
4. **Comment montrer l'angle et les éléments éditoriaux sans les inventer après coup ?** Trois niveaux, clairement séparés :
   - **Ce que LinkeePost a reçu** : les champs du profil, **mot pour mot**, affichés à l'étape 2 (la page lit les mêmes données que le moteur).
   - **Ce que LinkeePost a écrit** : le texte et le `why` de la **même génération**.
   - **Ce qui change** : un relevé **mécanique** (première ligne, mots propres à chaque texte), puis, si l'équipe l'ajoute, une **lecture éditoriale humaine** étiquetée « rédigée après génération… ce n'est pas une décision du moteur ». Aucun second appel IA n'est présenté comme une décision.
5. **Quel moyen le plus simple sans fragiliser l'application ?** Aucune modification du moteur, de Stripe, de LinkedIn ni des comptes existants. Une route nouvelle et isolée, un script hors application, et un fichier JSON versionné (`content/demo-editoriale.json`) lu au chargement. Vérifié : `git diff` du dossier `app/api/generate` et des modules du moteur est vide.

**Une réserve de méthode, à connaître avant de présenter la démonstration.** Les « convictions éditoriales » des trois profils sont des données que nous avons saisies. Pour BELVANTE, CANTEVEL et l'expert, elles sont proches des angles que l'on espère voir. Si le moteur les reprend, la démonstration prouve qu'il **applique** un positionnement, pas qu'il en **découvre** un. Trois garde-fous : le **témoin** (même sujet, aucun profil) ; les **mêmes consignes de style** pour tous (pour que ce soit l'angle, et non la forme, qui distingue) ; la **transparence** (la page dit que les profils sont saisis par nous). Et nous affichons les angles que le moteur choisit réellement, pas ceux qu'on attendait.

## 2. Ce qui a été construit

| Élément | Rôle |
|---|---|
| `lib/demoEditorialCore.mjs` | Socle pur : le sujet commun, les quatre identités (BELVANTE INDUSTRIE, CANTEVEL Conseil, Mathis Vauberlet, témoin), l'empreinte, la validation, le relevé mécanique. Partagé par la page et le script |
| `scripts/demo-editorial.mjs` | `seed`, `generate`, `list`, `publish`, `verify` |
| `content/demo-editoriale.json` | Les exemples publiés (vide aujourd'hui) |
| `lib/demoEditorial.js` | Lecture et validation côté serveur ; refuse tout exemple dont l'empreinte ne correspond plus |
| `app/demo-editoriale/page.js` | La route (non indexée, dynamique) |
| `components/DemoEditoriale.js` | Les cinq écrans : sujet, entreprises, prise de parole, ce qui change, conversion |
| `docs/demo-editoriale/*` | Ce document, la recommandation marketing, le protocole de test |

**L'expérience.** Une seule page, dans l'ordre : (1) la même information ; (2) trois cartes de profil **courtes** (positionnement et conviction, avec l'étiquette « entreprise fictive » pour BELVANTE et CANTEVEL et « expert fictif » pour Mathis Vauberlet) ; (3) **les trois publications complètes côte à côte** (empilées sur mobile), première ligne mise en évidence, puis **le témoin sans profil**, visible sans clic ; (4) si l'équipe l'a rédigée, une **lecture éditoriale**, dans un encadré distinct qui dit « Ce n'est pas une sortie du moteur » ; (5) l'invitation, qui réutilise le parcours existant (`JOIN_HREF`, donc `/beta` pendant la bêta). **Zone secondaire repliée** : profils complets, provenance, choix d'écriture annoncés par le moteur, relevé mécanique des textes. États gérés : absence d'exemple, exemple invalide (refusé), données de test (bandeau), fichier illisible. Accessibilité : structure sémantique, mouvement réduit respecté. Aucune dépendance ajoutée.

## 3. Produire, conserver et remplacer les exemples authentiques

**Ce qu'il faut** : la clé `ANTHROPIC_API_KEY` (la même que celle du serveur) et un accès réseau à l'API (vérifié : l'API est joignable depuis l'environnement de travail). **Jamais dans une conversation.** Deux voies :

- **Dans l'environnement de travail de Claude Code** : ajoutez la clé dans les paramètres de l'environnement (menu de l'environnement dans la barre de titre de la session, puis *Edit*, rubrique des secrets ou des variables d'environnement), sous le nom `ANTHROPIC_API_KEY`. **Une nouvelle session est nécessaire** pour qu'elle soit prise en compte ; demandez-y de lancer la génération (base locale jetable, vrai moteur).
- **Chez vous** : application lancée avec `DATABASE_URL` pointant vers **une copie de la base** (une branche Neon, **jamais la production**) et la vraie clé.

```
# 1. Comptes de démonstration (quatre comptes isolés, base de démonstration uniquement)
DEMO_EDITORIALE_DB_OK=1 node --env-file=.env scripts/demo-editorial.mjs seed

# 2. UNE génération par identité (BELVANTE, CANTEVEL, expert, témoin), avec le vrai moteur (le serveur doit tourner sur la même base)
node --env-file=.env scripts/demo-editorial.mjs generate --base http://localhost:3000 --runs 1

# 3. Lire les candidats, puis choisir
node scripts/demo-editorial.mjs list
node scripts/demo-editorial.mjs publish --belvante <id> --cantevel <id> --expert <id> [--temoin <id>] [--comparison lecture.json]

# 4. Contrôler, construire, déployer comme d'habitude
node scripts/demo-editorial.mjs verify
```

- **Conservation** : tous les candidats restent dans `data/demo-editoriale/candidates.json` (ignoré par Git). La page annonce « sélectionné parmi N générations » : le choix est visible, pas caché.
- **Remplacement** : relancer `generate`, puis `publish` avec d'autres identifiants ; le fichier publié est réécrit, l'ancien reste dans l'historique Git.
- **Lecture éditoriale (facultative)** : un fichier `lecture.json` `{ "authoredBy": "…", "note": "…", "rows": [{ "label": "Problème retenu", "belvante": "…", "cantevel": "…", "expert": "…" }] }`, rédigé **après** avoir lu les vrais textes.
- **Sécurité** : le script refuse `seed` sans `DEMO_EDITORIALE_DB_OK=1` ; il affiche l'hôte de la base ; les mots de passe des comptes de démonstration sont stockés localement avec des droits restreints ; rien n'est jamais publié sur LinkedIn ; aucune donnée de client n'est utilisée.

## 4. Compte rendu technique

**Fichiers créés** : voir le tableau du §2. **Fichiers modifiés** : aucun. **Moteur** : intact.

**Tests exécutés** (dans mon dossier de travail ; non versionnés, comme les précédents) :
- `th77` (32 contrôles) : la page dans cinq situations : aucun exemple (état réel du dépôt), jeu de test, texte altéré après coup, un seul exemple, fichier illisible. Dont : **aucune affirmation de provenance ni d'absence de retouche dans la page, même repliée**, tant que les données ne sont pas authentiques ; aucune métadonnée de génération en mode test ; trois publications complètes côte à côte (empilées sur mobile) ; témoin visible ; lecture humaine étiquetée ; zone technique repliée ; mouvement réduit ; **aucun appel IA pendant la visite**.
- `th79` (15 contrôles) : le chemin **authentique**, en remplaçant temporairement le fichier de contenu par la sortie de mon simulateur (jamais conservée) : les mentions de provenance **apparaissent** et sont exactes (empreintes, nombre de générations), aucune lecture n'est inventée, le fichier est restauré vide.
- `th78` (23 contrôles) : le dispositif de génération, avec mon simulateur de l'API : garde-fou de base, comptes, huit générations, **isolation des contextes**, même sujet et mêmes consignes, publication, vérification, **détection d'un texte modifié**, refus d'un candidat falsifié, échec propre quand le serveur est injoignable.
- Les tests précédents (visites, textes publics, déploiement) passent toujours.

**Limites restantes**
1. **Aucun exemple authentique** : il manque la clé `ANTHROPIC_API_KEY` dans l'environnement de construction. Le simulateur de test n'est **pas** le moteur de production : ses sorties ne sont jamais publiées.
2. **L'angle n'est pas une sortie du moteur** (voir §1).
3. **L'empreinte n'est pas une signature** (voir §1).
4. **Mise en page validée avec des textes de test** : la longueur et le rythme de vrais textes pourront demander un réglage.
5. **Une génération par identité par défaut** : aucun choix humain entre plusieurs essais, mais un échantillon d'un seul texte par profil. Relancer pour obtenir d'autres essais est possible ; la page annonce alors « retenu parmi N générations ».

**Consulter le prototype** : `npm run build && npm start`, puis ouvrir `http://localhost:3000/demo-editoriale`. Avec un jeu de test : `DEMO_EDITORIALE_FIXTURE=/chemin/fichier.json` (bandeau « Données de test » affiché).

## 5. Reprise : générer les quatre publications authentiques (voir aussi `session-generation-checklist.md`)

*À suivre dans une session où `ANTHROPIC_API_KEY` est définie (vérifier : la variable existe, sans l'afficher).*

1. Base locale jetable, application construite sans simulateur ni variable de test : `npm run build`, puis `next start` avec `DATABASE_URL` locale, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` et la vraie clé.
2. `DEMO_EDITORIALE_DB_OK=1 node scripts/demo-editorial.mjs seed`, puis `node scripts/demo-editorial.mjs generate --base http://localhost:<port> --runs 1`.
3. Publier les quatre candidats **sans les modifier** : `publish --belvante <id> --cantevel <id> --expert <id> --temoin <id>`, puis `verify`. Ne jamais éditer `content/demo-editoriale.json` à la main.
4. **Interdits** : créer une fixture, retoucher un texte, relancer jusqu'à obtenir un texte plus flatteur sans que le nombre de générations soit annoncé, déployer sans validation.
5. Si la génération échoue (clé, quota, réseau) : s'arrêter et le dire ; ne rien inventer.
