# Comment l'outil fonctionne : faits vérifiés dans le code (11 novembre 2026)

**Règle : on n'invente rien.** Chaque ligne renvoie au fichier qui la fonde. Ce document sert de source unique à la future page « Comment l'outil fonctionne » (`/produit/methode`). Une phrase du site qui n'est pas ici n'est pas publiable.

**Légende d'état**
- **A** : actif dans le code, sans condition autre que l'offre.
- **I** : derrière l'interrupteur serveur `EDITORIAL_ADVISOR=1` (« Compagnon éditorial »), puis le réglage de l'Administration (`all`, `accounts`, `off`). **Je ne peux pas voir la production** : l'activation est à confirmer par Jacques avant toute mention publique.
- **O** : action volontaire de l'utilisateur.
- **E** : moteurs expérimentaux (`EDITORIAL_ENGINE` B, B2, B2b). Absente = moteur A, inchangé. **Rien à dire publiquement.**

## 1. Le datalake (la base de connaissances)
| Fait | Source dans le code | État |
|---|---|---|
| L'utilisateur dépose des sources (documents, liens, notes) ; l'IA en tire résumé, thèmes, vocabulaire, positions et faits | `lib/knowledge.js`, `lib/knowledgeText.js` | A |
| **Un fait extrait n'est conservé que si tous ses nombres figurent dans le texte de la source** (contrôle fait par le code, pas par l'IA) | `factIsGrounded`, `normalizeFacts` (`lib/knowledgeText.js`) | A |
| Les sources utiles à un sujet sont choisies par le sens (vecteurs) et par les mots ; sans clé d'embeddings, par les mots seuls | `lib/knowledgeSemantic.js` | A |
| Le moteur résume ce qu'il a appris ; l'auteur échange avec lui ; **rien n'est retenu sans son accord** | `lib/datalakeEngine.js` (commentaire d'en-tête), `datalakeEngineText.js` | A, O |
| Éléments de langage validés : mots à privilégier, à éviter, formulations types | `lib/languageElements.js`, `datalakeEngineText.js` (`REMEMBER_KINDS`) | A, O |
| Les posts publiés par l'auteur sont lus en direct, jamais recopiés | `lib/datalakePosts.js` | A |

## 2. La génération d'un post
| Fait | Source | État |
|---|---|---|
| Le prompt reçoit : profil (titre, activité, cible, marché, objectifs), ligne éditoriale, consignes de style « à respecter impérativement », exemples de style, sources sélectionnées, remarques, langue, humeur, voix (profil ou page), public et angle du post | `app/api/generate/route.js`, `buildUserPrompt` | A |
| Règle donnée à l'IA : ne jamais inventer de nom, chiffre, statistique ou fait présenté comme réel ; à défaut, formuler en termes généraux ou comme cas type annoncé comme tel ; reprendre tel quel ce que la thématique, le profil ou le brief ont fourni | `ANTI_INVENTION_INSTRUCTION` (`lib/linkedinRules.js`) | A |
| Règle donnée à l'IA : en cas de deux informations contradictoires, n'en affirmer aucune comme établie | `lib/linkedinRules.js` | A |
| Règle donnée à l'IA sur les sources : reprendre **uniquement** ce qu'elles disent, sans déformer ni arrondir | `knowledgeBlock` (`lib/knowledgeText.js`) | A |
| **Ce sont des instructions à l'IA, pas des garanties** : le code ne vérifie pas le texte généré contre ces règles dans la route d'un post libre | `app/api/generate/route.js` (aucune vérification après réception, hors lecture du JSON) | A |
| Chaque post s'accompagne d'un « pourquoi » (accroche, structure, fin, hashtags) et de la liste des sources réellement utilisées | `WHY_INSTRUCTION`, `usedSources` | A |
| **Les sources ne sont pas citées dans le texte du post** : l'instruction interdit d'écrire « [S1] » ou le nom d'une source. Elles sont montrées à côté du post | `knowledgeBlock` | A |
| La longueur maximale est demandée à l'IA dans la consigne ; la route ne la tronque pas | `route.js` | A |

## 3. Les contrôles : quand et par qui
| Moment | Contrôle | Qui le fait | Source | État |
|---|---|---|---|---|
| Avant l'écriture | Analyse du brief : `ready`, `needs_clarification` (3 questions au plus), `blocked` (contradiction factuelle centrale). **Le statut est calculé par le code**, pas par le modèle. N'a lieu que si le sujet contient des faits (chiffre ou récit) | modèle rapide + code | `lib/advisorBrief.js` | I |
| À l'écriture | Règles et sources transmises au modèle (section 2) | instructions | `route.js` | A |
| Après l'écriture | **Chiffres à vérifier** : signale les nombres absents des informations fournies. Indicatif, tient compte de l'unité | code seul | `lib/figureCheck.js` | A |
| Après l'écriture | **Contrôle de forme** : note à règles fixes, sept critères | code seul | `lib/score.js` | A, offre Pro |
| Après l'écriture, à la demande | **Relecture factuelle indépendante** : un second modèle reçoit le brief, le profil, les sources et le texte, sans le raisonnement de rédaction. Alertes « Ajout du rédacteur » et « À confirmer », passage exact cité. Mention dans le code : « Ce n'est pas une preuve : c'est à vous de décider » | second modèle (Sonnet) | `lib/advisorVerify.js` | I |
| Après l'écriture | **Consignes de l'utilisateur** : zéro émoji, hashtags au maximum, mots à éviter, longueur maximale, tutoiement ou vouvoiement ; écart montré, jamais corrigé | code seul | `lib/consigneRules.js` | A |
| Campagnes | **Règles du brief** : zéro émoji, nombre maximal de hashtags, termes interdits, appel « commentez OUI » proscrit, lien exact de la publication, un seul lien utile ; avertissements : longueur, chiffre absent du brief, voix « nous » sur une page, ressemblance entre comptes, accroche trop proche d'une précédente | code seul | `lib/campaignChecks.js` | A |
| Campagnes | Écart à une règle du brief → **correction automatique sûre** (émojis retirés si zéro émoji demandé, hashtags ramenés au maximum), puis **une seule relance** de rédaction avec les corrections obligatoires ; la meilleure des deux versions est gardée | code + IA | `lib/campaignChecks.js` (`autoFix`), `lib/campaignPlanStore.js` | A |

**Conséquence pour les mots du site :** il n'y a pas de « contrôle continu pendant la génération » d'un post libre. Il y a des contrôles **à chaque étape** : avant (brief, si activé), à l'écriture (instructions), après (chiffres, forme, relecture si activée). Pour une campagne, le contrôle des règles du brief se fait **après chaque texte**.

**Le contrôle des consignes (ajouté le 11 novembre 2026).** Pour un post libre, le code lit les consignes de l'utilisateur (consignes de style, ligne éditoriale, remarques, mots « à éviter », longueur maximale du formulaire) et contrôle cinq types de consignes **explicites** sur le texte affiché : zéro émoji, nombre maximal de hashtags, mots à éviter, longueur maximale, tutoiement ou vouvoiement (en français). Une consigne ambiguë ou conditionnelle (« 3 hashtags », « tutoiement seulement sur les posts personnels ») ne produit aucune règle. Un écart est **montré sous le post**, jamais corrigé ni régénéré : l'utilisateur décide. Les autres consignes (ton, angle, style) sont transmises à l'IA, sans contrôle ensuite. Code : `lib/consigneRules.js`, `app/api/consignes/route.js`, composant `ConsignesCheck` (`app/app/page.js`). Route de génération non modifiée (moteur figé pour la démonstration).

## 4. Quand il y a un doute : c'est l'utilisateur qui tranche
| Situation | Ce qui se passe | Source | État |
|---|---|---|---|
| Chiffre absent des informations | Signalé sous le post ; l'utilisateur corrige, ajoute la source ou retire | `figureCheck.js` | A |
| Brief contradictoire ou incomplet | Questions posées avant l'écriture ; la réponse est ajoutée au sujet ; un « brouillon exploratoire » reste possible | `advisorBrief.js` | I |
| Alerte de la relecture | Gestes : **Confirmer** (« Aucune source indépendante n'a vérifié ce point »), **Retirer**, **Modifier**, **Reformuler prudemment** (proposition à accepter ou refuser), **Garder tel quel** / **Ignorer** (réversible). Le texte n'est **jamais modifié en silence** ; les décisions sont conservées tant que le passage est présent | `advisorReview.js`, `advisorRewrite.js` | I |
| Ce que le moteur apprend | Ne retient rien sans clic | `datalakeEngine.js` | A, O |
| Consignes durables proposées | Le copilote ou l'analyse des modifications proposent ; l'utilisateur accepte ou non (preuves chiffrées affichées pour les règles) | `lib/editorial/chat.js`, `lib/editLearning.js` | A, O |
| Campagne | Brief structuré par l'IA à partir d'un document, **relu par l'auteur avant création** ; exemple validé avant de lancer | `lib/campaignBrief.js` | A |
| Client d'agence | Validation par lien privé, sans compte | `lib/approval.js` | A, offre Agence |

**Exception à écrire noir sur blanc :** le **pilote automatique** (publication autonome, opt-in : `User.autoPublishThreshold`) programme directement la meilleure recommandation « sans passer par à valider ». Il est désactivé par défaut. La phrase « vous tranchez toujours » est donc fausse pour un compte qui l'active.

## 5. L'accompagnement et la gestion éditoriale
| Fait | Source | État |
|---|---|---|
| **Copilote éditorial** : propose des pistes (sujet, angle, justification), ne rédige pas de posts ; s'appuie sur le profil, les piliers, l'historique, le datalake et les remarques ; on envoie une piste au moteur de génération par « Générer ce post » | `lib/editorial/recommendations.js` | A |
| Piliers éditoriaux renommables, équilibrage des pistes | `lib/editorial/pillars.js` | A |
| Créneaux conseillés à partir de **vos** mesures réelles : aucun conseil sous 8 posts mesurés, 3 posts au moins par jour comparé ; une proposition, appliquée d'un clic ou ignorée | `lib/editorial/cadence.js` | A |
| **Coach** : comparaisons à votre médiane avec nombre de posts et niveau de confiance ; rien avant 8 posts mesurés ; pas d'apprentissage automatique ; ne lit pas LinkedIn | `lib/coach.js` | A |
| Apprentissage de vos habitudes d'édition : après au moins 3 posts modifiés, propose des consignes avec preuve calculée | `lib/editLearning.js` | A |
| Campagnes : brief, plan, calendrier, contrôle des règles, relance unique | `lib/campaign*.js` | A, offre Pro |
| Compagnon éditorial : carte « Vérifier mon post », reformulation, appliquée seulement par un clic | `components/EditorialAdvisor.js`, `lib/advisor*.js` | I |

## 6. Ce que l'outil ne fait pas (à publier)
- Il ne garantit pas qu'un chiffre est exact. Il signale ceux qui sont absents de vos informations.
- Il ne contrôle ni les noms propres, ni les citations, ni les études citées (`figureCheck.js`).
- Il ne contrôle par code que cinq types de consignes explicites (émojis, hashtags, mots à éviter, longueur, tutoiement ou vouvoiement) ; les consignes de ton, d'angle et de style sont transmises à l'IA sans contrôle ensuite.
- Il ne cite pas ses sources dans le texte du post.
- La relecture indépendante est un avis d'un second modèle, pas une preuve.
- Il ne prédit ni vues ni réactions.

## 7. Corrections nécessaires sur le site actuel
1. `/fonctionnalites`, « Votre matière » : « Chaque chiffre repris doit se retrouver dans une source, **citée dans le post** » est faux : les sources sont montrées à côté du post, pas dans son texte. Même phrase absolue que pour « Seconde vie d'un contenu ».
2. Deux contrôles de chiffres coexistent : `figureCheck.js` (posts libres) et la règle « Chiffre à confirmer » de `campaignChecks.js` (campagnes), dont l'algorithme diffère (liste d'unités et recherche par texte). La page doit décrire l'effet, pas un algorithme unique ; l'unification est une décision de produit.
3. La mesure publiée sur E4 (`docs/e4-chiffres/mesure-figurecheck/`) ne concerne que `figureCheck.js`.

## 8. À confirmer en production avant toute mention publique
- `EDITORIAL_ADVISOR` vaut-il `1` sur le serveur ? Quel périmètre dans l'Administration (carte « Compagnon éditorial ») : tous, comptes choisis, personne ?
- `EDITORIAL_ENGINE` est-il défini ? (Absent : moteur A, comme pour la mesure E4.)
