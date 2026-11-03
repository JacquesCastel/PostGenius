# Conseiller éditorial V1

Branche : `claude/conseiller-editorial-v1`. Interrupteur de développement : `EDITORIAL_ADVISOR=1` (désactivé par défaut). **Non déployé, non commité.**

## 1. État des lieux technique (vérifié dans le dépôt)
- **Architecture** : Next.js 15 (App Router), React 19, Tailwind, Prisma/Postgres, sessions par cookie (`lib/session.js`). Un seul gros composant client, `app/app/page.js` (≈ 23 800 lignes), qui contient toute l'application connectée.
- **Parcours de création** : vue « Créer un post » (sujet, humeur, réglages) → `handleGenerate` → `POST /api/generate` → vue résultat (`LinkedInPreview`, édition par `textarea`, historique des versions, `RefineChat`, `PostWhy`) → brouillon (`/api/drafts`).
- **Génération** : `app/api/generate/route.js` (moteur A, modèle `claude-sonnet-4-6`, contrat `text`, `extra`, `why`, `sources`). Profil, entreprise (`Context`), sources (`lib/knowledge.js`), mémoire, voix d'auteur et remarques sont assemblés dans la route.
- **Garde-fous existants réutilisés** : `getEffectiveUserId` (session, agence), `checkAccess` (essai/abonnement), `rateLimit` en mémoire, `logUsage` (jetons par compte), coupe-circuit IA global `lib/aiGuard.js` (remplace `fetch` vers Anthropic/OpenAI).
- **Persistance** : le texte du post vit dans l'état React jusqu'à l'enregistrement du brouillon. Il n'existe pas de champ pour des décisions de relecture ; je n'ai **pas** modifié le schéma Prisma.
- **Travaux expérimentaux** : `docs/eval-editorial/` (moteurs A, B, B2, B2b, vérificateur indépendant). Aucun n'est utilisé dans le parcours principal ; leurs tests de non-régression (empreintes de A, B, B2, B2b) sont conservés.

## 2. Décisions techniques
| Sujet | Décision | Pourquoi (et comment revenir en arrière) |
|---|---|---|
| Moteur A | Inchangé. Aucune importation du conseiller dans `/api/generate`. | Contrainte du produit ; testé (empreintes + absence d'import). |
| Analyse du brief | Un appel court **Haiku**, seulement si le sujet contient des faits (chiffres, récit, « nous avons… ») ; sinon aucun appel. Le **statut est calculé en code** à partir des problèmes relevés. | Pas de multiplication des appels IA ; le modèle ne décide pas du statut. |
| Vérificateur | Prompt **v2 du protocole** (`lib/verifierPrompt.mjs`, empreinte vérifiée) avec bloc de sources optionnel ; modèle **Sonnet** (`EDITORIAL_VERIFIER_MODEL` pour changer). | Demande explicite ; Haiku détectait trop peu (53 %). |
| Catégories | « bloquante » → *Affirmation non étayée* ; « modérée » → *À confirmer* ; « mineure » écartée ; convictions/interprétations jamais en alerte (liste repliée). Une alerte proche de ce que décrit le profil est ramenée à *À confirmer*. | Limite les faux blocages mesurés (60 %). Aucune alerte ne bloque quoi que ce soit. |
| Interrupteur | Variable serveur `EDITORIAL_ADVISOR=1` ; l'interface interroge `GET /api/advisor/status`. | Une seule variable, pas de reconstruction du front. |
| Persistance des décisions | `localStorage`, clé = empreinte du texte (20 relectures conservées). | Pas de migration de base. Limite : propre au navigateur. |
| Reformulation | Appel séparé, renvoie une **proposition** ; appliquée uniquement par un clic. | « Ne jamais modifier silencieusement le post ». |

## 3. Fonctionnement
**Fonction 1, analyse du brief** (`POST /api/advisor/brief`) : trois états.
- `ready` : la génération continue.
- `needs_clarification` : information essentielle manquante ; 3 questions au plus, pas de question secondaire ; génération possible quand même.
- `blocked` : contradiction **factuelle** centrale (deux affirmations incompatibles sur le même sujet et la même période). Une opposition d'idées n'en est pas une. L'auteur répond ; sa réponse est ajoutée au sujet (« Précisions de l'auteur ») ; l'option « brouillon exploratoire » existe, nettement moins visible.

**Fonction 2, génération** : moteur A, inchangé.

**Fonction 3, « Vérifier mon post »** (`POST /api/advisor/verify`) : le vérificateur reçoit le brief avec ses précisions, le profil de marque (et l'entreprise choisie), les sources réellement disponibles et le texte. Il ne reçoit ni raisonnement de rédaction, ni ancien avis. Chaque alerte : passage exact, motif, justification, action proposée. `POST /api/advisor/rewrite` propose une reformulation prudente d'un seul passage.

## 3 bis. Évolution après les premiers essais : « ajouts du rédacteur à valider »
Retour d'usage : voir le moteur « énumérer des problèmes » après coup est déroutant. La relecture est donc présentée comme **ce que le rédacteur a ajouté au-delà du brief**, à valider ou non :
- **Lecture du post par origine** (vert : établi par le brief ; bleu : conviction ou interprétation ; jaune : ajout à valider). Un clic sur un passage jaune mène à son ajout dans la liste. Aucun coût en plus : le vérificateur produisait déjà ces catégories.
- **Gestes par ajout** : Confirmer, Retirer, Modifier, Reformuler prudemment, Garder tel quel.
- **« Proposer une version prudente des N ajouts »** : un seul appel (`POST /api/advisor/rewrite-all`, ≈ 0,003 $), une proposition par passage, **chacune à cocher** ; « Appliquer N reformulations » est un geste explicite, et la version précédente reste récupérable.
- Limite constatée : une reformulation peut conserver une part du fait signalé (« … qui n'avait pas vocation à être mise en avant »). L'interface le dit ; la nouvelle vérification ou « Retirer » règle le cas.

## 3 ter. « Votre compagnon éditorial » : mise en avant et édition d'un brouillon existant
- **Mise en avant** : la carte porte la couleur de son état (coral pour l'invitation, bleu en cours, ambre pour les points à examiner, vert quand tout est traité, rouge en cas d'erreur) et passe **en tête de la colonne de droite**, avant « Améliorer ce post ». Après la génération, elle invite : « Votre post est prêt. Je le relis avec vous ? », avec un bouton principal « Vérifier mon post » et « Plus tard ». « Plus tard » replie la carte en une barre colorée toujours cliquable ; elle ne disparaît jamais.
- **Édition d'un brouillon existant** : dans « Mes posts » → « Modifier et optimiser » (page « Optimiser votre post »), le compagnon est en tête de la colonne de droite. Il utilise le **brief enregistré avec le brouillon** (`theme`) et l'entreprise du brouillon. « Modifier » place le curseur sur le passage dans l'éditeur ; « Appliquer » remplace le texte **dans l'éditeur seulement** et ajoute une version « Compagnon éditorial » à l'historique ; l'enregistrement du brouillon reste le geste explicite « Enregistrer le brouillon » (vérifié : le texte enregistré ne change pas tant qu'on n'enregistre pas). Rouvrir le même texte retrouve la relecture et les décisions (même empreinte, dans le même navigateur).
- Limites constatées : sur un **sujet thématique**, le vérificateur signale parfois beaucoup de généralisations (5 ajouts sur un post d'opinion) ; sur **mobile**, la carte se place sous l'aperçu (colonne unique) et peut passer inaperçue ; le compagnon n'existe toujours pas pour les séries ni les variantes (les campagnes : voir § 3 quinquies).

## 3 quater. Activation par compte (Administration)

`EDITORIAL_ADVISOR=1` reste l'interrupteur général du serveur : sans lui, personne n'a le conseiller. Au-dessus, l'Administration choisit le périmètre (carte « Compagnon éditorial », réglage stocké dans `SiteContent` sous `advisor-mode`, effet en moins de 10 s) :

- **Tous les comptes** : comportement d'avant, et valeur par défaut tant que rien n'est enregistré (la mise en ligne ne change donc rien pour les utilisateurs) ;
- **Comptes choisis** : seuls les comptes cochés (bouton « Conseiller » sur chaque ligne de la liste des utilisateurs, champ `User.advisorAccess`, fermé par défaut) et les administrateurs ;
- **Personne** : coupure sans toucher au serveur.

Le test se fait côté serveur, sur le compte effectif de la session (donc le client observé avec « Voir comme ») : `/api/advisor/status` répond `enabled` pour ce compte, et les quatre routes de calcul répondent 404 aux autres, avant tout calcul ou comptage de limite. Chaque changement de périmètre est inscrit au journal des actions d'administration. Le changement de schéma est un simple ajout de colonne.

## 3 quinquies. Campagnes

Le compagnon apparaît aussi sous le texte de chaque publication rédigée d'un plan de campagne (hors publications déjà publiées), derrière les mêmes interrupteurs (serveur, périmètre, compte).

- **Brief d'origine donné au vérificateur** (`lib/advisorCampaign.js`) : sujet, objectif, appel à l'action et format de la publication, puis les faits de la campagne (contexte, publics, objectif, message du brief structuré, précisions enregistrées avec la campagne). Les règles, les interdits, les liens et le brief visuel ne sont pas des faits et ne sont pas transmis. Les « faits à confirmer » de la publication le sont, signalés comme **non confirmés** : le vérificateur ne les tient pas pour établis. La limite du brief de la route de vérification passe de 2 500 à 6 000 caractères.
- **Marque** : la relecture utilise l'entreprise de la campagne (`contextId`), comme la rédaction.
- **Appliquer / Retirer / Reformuler** écrivent dans le texte de la publication et l'enregistrent par la route texte existante, comme toute retouche de cette zone (la version générée est conservée). Rien n'est validé, programmé ni publié par ce geste. « Modifier » place le curseur sur le passage.
- La zone de texte n'est plus remontée à chaque enregistrement (la clé ne contient plus le texte) : la relecture et les décisions survivent à l'enregistrement. Une réécriture de la publication ou un enregistrement venu d'ailleurs sont repris tant qu'aucune modification locale n'est en attente.
- Limites : la production « par lots » ne déclenche aucune relecture (à la demande uniquement) ; la limite de 30 relectures par heure et par compte s'applique, une campagne longue peut l'atteindre.

## 4. Parcours utilisateur (vérifié dans l'application)
1. L'auteur saisit un sujet contradictoire et clique sur « Générer mon post ». La carte « Avant d'écrire : une contradiction à clarifier » s'affiche, avec la citation, une question précise et un champ de réponse déjà actif.
2. Il répond, clique sur « Ajouter et générer » : le post est écrit à partir du sujet précisé, sans conciliation inventée.
3. La carte « Relecture factuelle » (état *Non vérifié*) propose « Vérifier mon post ». Pendant l'appel : *Vérification en cours*, avec « Annuler ».
4. Résultat : *Points à examiner*. Pour chaque alerte : **Confirmer** (« Confirmé par vous. Aucune source indépendante n'a vérifié ce point »), **Modifier** (ouvre l'éditeur avec le passage sélectionné), **Reformuler prudemment** (proposition à appliquer ou refuser), **Ignorer** (explicite, réversible).
5. Dès que le texte change : *Texte modifié : à revérifier* ; les alertes dont le passage a disparu passent à « modifié », les autres restent traitables. Après une nouvelle vérification, les décisions « confirmé » et « ignoré » sont reportées sur les passages qui se recouvrent.
6. Si tous les points sont traités : *Relecture terminée*. Aucune mention de fiabilité garantie ; rien ne bloque la publication.
7. Interrupteur désactivé : le parcours est identique à l'existant (vérifié dans le navigateur : pas de carte, pas de bouton, aucun appel hors `status`).

## 5. Fichiers
- **Logique pure** : `lib/advisorBrief.js`, `lib/advisorReview.js` (dont la lecture par origine), `lib/advisorVerify.js`, `lib/advisorRewrite.js`, `lib/advisorFlag.js`.
- **Serveur** : `lib/advisorLlm.js` (appel au modèle, erreurs typées), `lib/advisorRoute.js` (préambule : interrupteur, session, accès, limite, taille ; profil et sources du seul compte), `app/api/advisor/{status,brief,verify,rewrite,rewrite-all}/route.js`.
- **Interface** : `components/EditorialAdvisor.js` (cartes de questions et de relecture), branchements dans `app/app/page.js` (≈ 65 lignes, tous derrière l'interrupteur).
- **Prompt** : `lib/verifierPrompt.mjs` (bloc `sourcesBlock` optionnel, texte v2 inchangé sans lui).
- **Tests** : `scripts/advisor.test.mjs`, essai de bout en bout `scripts/advisor-smoke.mjs`.

## 6. Tests réalisés
- **69 tests unitaires** (`node --test scripts/advisor.test.mjs scripts/engine-b*.test.mjs scripts/eval-editorial.test.mjs`), tous verts : les 10 scénarios demandés, plus caducité, report des décisions, erreurs d'API, limites de taille, sécurité (aucun `console.log`, journaux limités au type d'erreur) et non-régression (empreintes A, B, B2, B2b ; prompt v2 du vérificateur).
- **Essai de bout en bout contre un serveur réel, 20 contrôles sur 20** : briefs complets → `ready` (4 sur 4), incomplet → `needs_clarification` (« Quel est le nom exact du prix reçu ? »), contradictoire → `blocked`, sujet thématique → aucun appel IA, conviction → pas de contradiction ; vérification d'un texte inventé → alerte avec passage retrouvé ; garde-fous (400, 401, 409, 413).
- **Parcours complet dans le navigateur** : questions avant génération, génération, vérification (3 alertes), reformulation appliquée, confirmation, « Modifier » avec sélection du passage, caducité, erreur de délai avec reprise, flag désactivé.

## 7. Coût et latence mesurés
| | Latence | Tokens (entrée / sortie) | Coût estimé |
|---|---:|---:|---:|
| Analyse du brief (Haiku) | 2,2 à 2,5 s, **aucun appel** pour un sujet thématique | 505 / 115 | 0,0011 $ |
| **Vérification (Sonnet)** | **9,7 s** en moyenne (5,5 à 13 s) | 1 735 / 564 | **0,0137 $** |
| Reformulation d'un passage | 1,4 s | 638 / 34 | 0,0024 $ |
La vérification n'est jamais automatique : le coût de génération (0,012 $) ne change pas tant que l'auteur ne la demande pas.

## 8. Limites connues
- **Faux positifs** : mesurés à 60 % de faux blocages sur les textes jugés propres (développement du banc d'essai). Pendant mes essais, un texte de conviction a reçu une alerte « Affirmation non étayée ». C'est pourquoi toutes les alertes sont traitables en un clic et aucune ne bloque.
- **Faux négatifs** : environ 3 % des inventions manquées au développement du banc d'essai (1 sur 34), sans garantie sur d'autres briefs. Une relecture sans alerte n'est pas une preuve, et l'interface le dit.
- **Étiquettes de référence** issues d'assistants IA, non d'une validation humaine indépendante.
- **Portée** : le bouton existe dans la vue résultat de la création d'un post (post unique). Pas encore dans l'édition d'un brouillon existant, ni pour les séries et variantes.
- **Persistance** : décisions retrouvées dans le même navigateur seulement ; non enregistrées avec le brouillon.
- **Surlignage** : le passage est surligné dans la carte et sélectionné dans l'éditeur ; pas dans l'aperçu LinkedIn.
- **Délai dépassé** : constaté deux fois après une pause de la machine ; la requête identique répond ensuite en 13 s. L'erreur est gérée (texte conservé, reprise possible), mais la cause réseau n'est pas isolée.
- **Limites de débit en mémoire** (30 vérifications par heure et par compte) : valables pour une seule instance.

## 9. Avant une mise en production
1. Relecture humaine indépendante d'un échantillon d'alertes (faux positifs) et décision sur la gravité affichée.
2. Choisir la persistance : champ JSON sur le brouillon (migration) ou conservation locale.
3. Étendre le bouton à l'édition d'un brouillon existant, aux séries et aux variantes.
4. Test d'accessibilité complet (lecteur d'écran, clavier) et test mobile réel.
5. Limites de consommation partagées (base ou Redis) et plan tarifaire éventuel.
6. Journaliser des indicateurs anonymes (taux de confirmation, d'ignorance, de reformulation) pour mesurer l'utilité réelle.
7. Activer par compte pilote avant toute généralisation.
