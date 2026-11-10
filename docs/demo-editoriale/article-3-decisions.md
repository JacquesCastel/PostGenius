# Article 3 : décisions du 10 novembre 2026 et ce qu'elles changent

**Le plan de l'article 3 lui-même (titre de travail, accroche, tableau de la section 4, section 7, fiche, « Risques et pièges ») n'a pas été retrouvé** : ni dans le dépôt, ni dans les artefacts, ni dans Notion. Ce document contient donc (1) ce qui a été appliqué au code et aux documents de la démonstration, et (2) les modifications à reporter dans le plan, avec leur règle de transformation. Envoyer le plan (collé ou en lien) permet de les y appliquer en place.

## 1. Ce qui est fait dans le dépôt
| Décision | Où |
|---|---|
| Wharf exclu | retiré de `lib/demoEditorialCore.mjs` ; note de transparence datée dans `README.md` |
| Expert indépendant ajouté (Mathis Garlandier, Garlandier Conseil) | `lib/demoEditorialCore.mjs` (profil complet, déclaré fictif) ; libellés de la page (« Trois profils », « Expert fictif ») ; `verification-noms-fictifs.md` |
| **Composition : trois profils + le témoin = quatre textes** (choix de Jacques, 10 novembre) | ASTER INDUSTRIE, AXIOME Conseil, Mathis Garlandier, témoin |
| Seuils du protocole de test | **inchangés** : l'appariement reste sur trois profils (hasard 1 sur 6, seuils 40 % et 60 %), documenté dans `protocole-test.md` avant tout entretien |
| Profil figé avant la session | `gel-demo-empreintes.md` (à publier avant la génération) |
| Session de génération | `session-generation-checklist.md` : base isolée, enregistrement complet, empreinte par enregistrement, `--runs 1`, révocation de la clé |
| Tests | `scripts/demo-editorial.test.mjs` (7 tests : composition, mention « fictif », consignes de style identiques, profils sans chiffre, refus d'un profil modifié) |

**Pourquoi « quatre textes » et pas « cinq » : la consigne de départ comptait « trois industrielles + expert + témoin ».** Wharf était l'une des trois ; Wharf étant exclu, il reste deux entreprises, l'expert et le témoin. Choix de Jacques : on s'en tient à quatre textes (une troisième entreprise n'est pas créée).

## 2. À reporter dans le plan de l'article 3
- **Titre de travail et variantes.** Retirer tout nombre d'entreprises (« trois entreprises ») : la démonstration montre **deux entreprises et un expert**. Reformuler sans nombre, ou écrire « trois profils ». Formulation retenue, inchangée : **« Le même sujet. Votre point de vue. »**
- **Accroche.** « Les premières lignes de quatre posts côte à côte » reste exact **si le témoin figure** parmi eux (trois profils + témoin). Sans le témoin, écrire trois.
- **Tableau de la section 4.** Retirer la ligne Wharf ; ajouter la ligne de l'expert (positionnement : cotation fonctionnelle ; cible : concepteurs, dessinateurs, responsables qualité de PME industrielles ; marché : conseil et formation indépendants ; objectif : se faire connaître et obtenir des demandes de formation et d'audit de plans). Le nombre de textes passe à **quatre**.
- **Section 7.** « Trois profils » reste « trois profils », composés de **deux entreprises et un expert** ; ne plus dire « trois industriels ».
- **Fiche (conditions de publication).** Ajouter : profils figés et empreintes publiées avant la génération ; une génération par identité, aucun choix ; les trois profils et le témoin déclarés **fictifs** ; test avec 5 à 10 professionnels avant publication ; arbre de décision (voir 4).
- **« Risques et pièges ».** Remplacer le risque « Wharf est la société de Jacques » par cette note : *« Décision du 10 novembre 2026, avant toute génération : Wharf est exclu de la démonstration. Le risque que cela soulevait est levé. »* C'est un point de transparence : ne pas le supprimer sans trace.

## 3. Appel à l'action
- **Dans le corps** : lien vers `/demo-editoriale`, présenté **comme une preuve**, pas comme un produit.
- **Hors du corps** : lien vers la bêta en **premier commentaire** ou en **fin d'article, séparé et identifié comme tel**.
- Les articles 1 et 2 n'ont aucun appel commercial : l'article 3 ne casse pas cette cohérence. Mettre la fiche à jour.

## 4. Calendrier restant
1. Créer et figer le profil expert : **fait côté code**, reste la relecture de Jacques, les éventuelles vérifications de registres et la **publication du gel**.
2. Session de génération (quatre textes) + révocation de la clé : `session-generation-checklist.md`.
3. Test avec 5 à 10 professionnels (20 min, pas d'amis proches) : `protocole-test.md`.
4. Rédaction de l'article 3 à partir des résultats, relecture contre le dossier de preuves.
5. **Arbre de décision** : appariement < 40 %, ou majorité qui ne voit que le ton → l'article ne se publie pas sous cette forme ; on écrit l'article sur ce que le test a appris.

## 5. Contraintes inchangées
Aucun texte généré n'existe encore : aucun extrait ne figure dans le plan. Les entreprises et l'expert sont déclarés fictifs. Aucune promesse de portée, jamais « LinkedIn favorise » ni « mieux que ChatGPT ». Formulation : « Le même sujet. Votre point de vue. »
