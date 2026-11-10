# Article 3 : plan détaillé v3 (la démonstration)

*Plan du 10 novembre 2026, version 3. Il remplace la v2 du même jour, qui comptait encore Wharf dans le décompte des identités. **Aucun texte généré n'existe encore** : les quatre générations de la démonstration n'ont pas lieu tant que le profil expert n'est pas figé (gel publié) et que la session avec `ANTHROPIC_API_KEY` n'est pas ouverte. Ce plan ne cite donc aucun extrait de texte et n'en invente aucun. Tout ce qui dépend des vrais textes est marqué **[TEXTES]**.*

## Ce qui change par rapport à la v2

| Passage de la v2 | Dans la v3 | Pourquoi |
|---|---|---|
| « cinq textes », « trois identités industrielles + une identité experte + un témoin » | **quatre textes** : deux entreprises industrielles fictives (ASTER INDUSTRIE, AXIOME Conseil), un expert indépendant fictif (Mathis Garlandier), un témoin | Wharf, l'une des trois « industrielles » de la v2, est exclue ; décision de Jacques du 10 novembre de ne pas créer de troisième entreprise |
| « quatre identités », « quatre points de vue », « quatre profils » | **trois profils** (et un témoin) | idem |
| « validé pour un appariement à quatre identités » | **validé pour trois profils, protocole inchangé** : hasard 1 sur 6, seuils 40 % et 60 % | `protocole-test.md`, section du 10 novembre. Avec quatre textes à apparier, le hasard tomberait à 1 sur 24 et le seuil de 60 % serait à redéfinir avant le test |
| Titre « Même sujet, quatre points de vue » et variante « Quatre entreprises… » | titre en **trois** ; variante « Deux entreprises, un expert, un sujet… » | l'expert n'est pas une entreprise |
| « PR 344, non fusionnée » ; « Fusion de la PR 344 seulement après vrais textes » | **PR 344 déjà fusionnée dans `main` le 3 novembre 2026** (page `/demo-editoriale` présente, vide) ; les changements de la v3 sont sur la branche `claude/funny-goodall-f2dvgs` | état vérifié sur GitHub le 10 novembre |
| Section 5 : « cette règle d'invite est ce qui fait tomber les éléments non supportés de 2,8 à 0,3 » | **reformulé** : E4 mesure l'effet de l'invite de LinkeePost dans son ensemble, il n'isole pas la consigne « aucun chiffre inventé » ; limites publiées reprises | cette attribution à une règle précise n'est pas dans les résultats E4 |
| « les résultats E4 ont été publiés le 10 novembre », « Article 1 publié avant » | **résultats et annexes publics (gists) ; l'article E4 n'est pas encore publié** | état au 10 novembre : la condition 4 de publication reste ouverte |
| « La page de démonstration mise à jour pour cinq textes » | **fait côté code pour quatre textes** (branche `claude/funny-goodall-f2dvgs`) ; reste la PR et le déploiement | commit `5a07619` |

## Décisions tranchées le 10 novembre 2026

| Décision | Choix | Conséquence |
|---|---|---|
| Profil expert indépendant | **Ajouté** (Mathis Garlandier, Garlandier Conseil) | La démonstration compte **trois profils et un témoin : quatre textes** ; profil à figer avant toute génération |
| Wharf (société de Jacques) | **Exclue** | Le conflit d'intérêts est levé par décision, datée et antérieure aux générations |
| Composition | **Quatre textes** (pas cinq) | Aucune troisième entreprise n'est créée |
| Appel à l'action | **Démo + bêta** | Lien `/demo-editoriale` dans le corps (preuve) ; lien bêta hors corps (premier commentaire ou fin d'article), séparé et identifié |

## Fiche

| | |
|---|---|
| **Titre de travail** | Même sujet, trois points de vue : ce qui change quand on donne une identité à une IA (et ce qui ne change pas) |
| **Variantes** | « Deux entreprises, un expert, un sujet : lisez ce que l'IA écrit quand elle sait pour qui » · « Le test à faire avant de croire qu'un outil comprend votre point de vue » |
| **Rôle dans la série** | Pièce de preuve : l'article 1 pose le risque (les chiffres inventés, test E4), l'article 2 le contexte (LinkedIn et l'« AI slop »), l'article 3 montre ce qu'un outil peut faire de mieux et comment le vérifier soi-même |
| **Thèse** | Un même sujet traité avec trois identités produit trois textes qui diffèrent sur le **fond** (problème posé, angle, message), pas seulement sur le ton. C'est une cohérence avec un profil, pas une supériorité sur un assistant généraliste. Le lecteur peut refaire le test en dix minutes |
| **Lecteur visé** | Expert indépendant, dirigeant de PME, responsable communication qui évalue des outils d'IA pour LinkedIn |
| **Mot-clé principal** | « post LinkedIn IA point de vue » *(volumes non mesurés : outil SEO inaccessible)* |
| **Longueur** | 1 500 à 1 800 mots |
| **Appel à l'action** | Lien vers `/demo-editoriale` dans le corps, comme **preuve**. Lien vers la bêta **hors du corps** (premier commentaire ou fin d'article), séparé et identifié comme tel. Aucune autre incitation |

## Conditions de publication (rien ne sort sans elles)

1. **Quatre textes authentiques** (deux identités d'entreprise fictives, une identité d'expert fictive, un témoin sans profil), générés par le vrai moteur dans une base isolée, avec enregistrement complet (requête, profil lu en base, réponse) et empreinte SHA-256 par enregistrement. *Bloqué : nécessite le gel publié, puis une session où `ANTHROPIC_API_KEY` est visible (présence vérifiée sans affichage). Voir `session-generation-checklist.md`.*
2. **Test avec 5 à 10 professionnels** selon `docs/demo-editoriale/protocole-test.md`, **validé pour un appariement à trois profils** (inchangé, documenté le 10 novembre avant tout entretien). Si l'appariement des textes est inférieur à 40 %, ou si la majorité ne voit que le ton, **la thèse est fausse et l'article ne se publie pas sous cette forme.**
3. **Contrôle des chiffres** des quatre textes avec la grille du protocole E4 (voir section 5). Un chiffre inventé dans un texte de démonstration serait publié tel quel. *Précédent : les résultats E4 et leurs annexes sont publics depuis le 10 novembre 2026, y compris les éléments défavorables.*
4. **Article 1 publié avant**, pour que l'article 3 puisse y renvoyer. *Ouvert à ce jour : les résultats E4 sont publics dans des gists, mais l'article lui-même n'est pas encore publié.*

## Squelette

### 1. Accroche : les premières lignes de trois posts **[TEXTES]**
Ouvrir sur les premières lignes des trois posts des profils, côte à côte, sans les nommer : même sujet, trois accroches, dont celle de l'expert indépendant, qui parle directement au lecteur visé. Demander au lecteur de deviner laquelle correspond à quelle identité avant de lire les trois descriptions. Le témoin, lui, vient plus loin (section 4) : le montrer ici ajouterait un quatrième texte à apparier et changerait la difficulté du jeu. *Seuls des textes réellement générés sont utilisables ; la page de démonstration en mode « fixture » n'est jamais présentée comme authentique.*

### 2. Voix ou point de vue ? (la distinction)
- Ce que beaucoup d'outils vendent : imiter la **forme** (votre voix, votre style).
- Ce que la démonstration cherche à montrer : appliquer un **positionnement** (qui parle, à qui, avec quelle conviction) à un sujet donné.
- Lien avec l'article 2 : la définition de LinkedIn du contenu vide est « polished… but lacks substance… doesn't have any particular experience, perspective, or insight » (Sam Corrao Clannon, Social Media Today, 20 août 2026, dossier de preuves, entrée 7 : *citation reprise de la v2, non revérifiée ici*). Un texte avec un point de vue n'est pas pour autant un texte que LinkedIn épargne : on ne dit pas l'inverse.
- *À sourcer* : l'affirmation « le marché vend déjà "votre voix" » vient de l'analyse de marché de l'audit stratégique ; la reprendre avec les pages tarifs/produits relevées (dates), ou l'écrire comme observation.

### 3. La méthode, sans artifice
Transparence comme argument de confiance :
- Un **sujet commun** unique (367 caractères dans la version actuelle de `lib/demoEditorialCore.mjs`, vérifié le 10 novembre).
- **Trois profils** (deux entreprises industrielles fictives et un expert indépendant fictif) + un **témoin sans profil**, avec des consignes de style **identiques** pour les quatre.
- Textes **générés par le moteur, non retouchés**, avec le nombre de générations dont ils sont issus, et la règle de choix écrite avant (aucune sélection du « meilleur »). Avec `--runs 1`, il n'y a aucun choix à faire.
- Empreinte de chaque enregistrement, vérifiable au chargement de la page.
- Rappel de limite : **une empreinte prouve qu'un texte n'a pas été modifié, pas qu'il n'a pas été trié.**

### 4. Ce qui change, et ce qui ne change pas **[TEXTES]**
- Tableau : pour chaque texte (trois profils + témoin), le problème posé, l'angle, le message, l'appel final.
- Lecture éditoriale humaine, **étiquetée comme telle** (c'est un jugement, pas une mesure).
- Le témoin : ce que le moteur écrit quand il ne connaît pas l'entreprise. C'est le meilleur argument et le plus risqué : si le témoin ressemble aux trois autres, la thèse tombe, et on l'écrit.
- Résultats du test avec les professionnels (appariement, différence spontanée), présentés comme **qualitatifs** : 5 à 10 personnes ne donnent aucun pourcentage statistique. Noter, comme le protocole le prévoit, deux biais propres à cette composition : l'expert écrit peut-être à la première personne du singulier (indice de forme), et les experts indépendants du panel peuvent s'identifier à son profil.

### 5. Les chiffres de ces textes **[TEXTES, E4]**
Appliquer la grille de l'article 1 aux quatre textes : combien d'éléments factuels, combien absents des données fournies. Les consignes de style demandent « aucun chiffre inventé ». Dire ce qui se passe réellement, y compris si un chiffre apparaît.
*Ce que E4 permet de dire, et rien de plus :* dans ce test, LinkeePost a produit 0,3 élément non supporté par post contre 2,8 pour un modèle appelé avec les mêmes faits (1,6 contre 0,1 si l'on retire les chiffres d'exemple et de conseil), ce que le test attribue à l'invite de LinkeePost dans son ensemble. Il **n'isole pas** quelle partie de l'invite agit : la consigne de style « aucun chiffre inventé » n'a pas été testée seule. À reprendre avec les limites publiées : un seul classeur, 10 sujets, une génération par cas.

### 6. Ce que cette démonstration ne prouve pas
Reprise de `recommandation-marketing.md`, §5, sans l'édulcorer :
- Elle ne prouve pas que LinkeePost **écrit mieux** qu'un assistant généraliste : elle montre une cohérence avec un profil.
- Le moteur **n'invente pas l'angle** : il applique des convictions que nous avons saisies.
- Elle ne dit rien de la **volonté de payer**.
- Les profils de démonstration sont **fictifs** (deux entreprises industrielles, un expert) ; l'audit stratégique suggère que la cible réelle est l'expert indépendant, désormais représenté dans la démonstration, ce qui réduit l'écart sans le supprimer : un profil fictif d'expert n'est pas un expert réel. À dire.

### 7. Refaire le test chez vous (dix minutes)
Section utile quel que soit l'outil :
1. Choisissez un sujet.
2. Rédigez trois profils courts (qui, pour qui, ce que vous défendez).
3. Demandez le même post à l'outil pour chaque profil, sans toucher aux consignes.
4. Comparez : le **problème posé** change-t-il, ou seulement le vocabulaire ? Un lecteur qui connaît les trois identités reconnaît-il les textes ?
5. Vérifiez chaque chiffre avec le test de deux minutes de l'article 1.

### 8. Notre position
- Nous éditons LinkeePost : nous sommes juge et partie sur cette démonstration, et nous le disons.
- La promesse défendue est étroite : **écrire pour quelqu'un**, pas écrire mieux. Formulation retenue par la recommandation marketing : « Le même sujet. Votre point de vue. » À éviter : « comprend », « intelligence », « copilote », toute promesse de portée.
- Aucun texte de la démonstration n'est présenté comme conforme à ce que LinkedIn autorise ou favorise.

## Arbre de décision selon le test avec les professionnels

| Résultat | Sort de l'article |
|---|---|
| Appariement ≥ 60 % et majorité qui voit un changement de fond | Publier, avec les résultats qualitatifs |
| Appariement entre 40 % et 60 % | Publier seulement une version prudente : ce que nous voyons, ce que les testeurs ont vu, et l'écart |
| Appariement < 40 %, ou majorité qui ne voit que le ton | **Ne pas publier** ; retravailler (une seule chose à la fois) et retester ; écrire un article sur ce que le test a appris |
| Textes jugés génériques ou artificiels malgré les profils | Même décision : retravailler |
| Compréhension sans envie d'essayer | Publier la méthode, mais pas de promesse de valeur : la preuve est claire, la valeur ne l'est pas |

*Seuils repris du protocole de test, à ne jamais modifier après avoir vu les résultats. Validés pour trois profils avant le test (hasard : 1 chance sur 6) ; tout ajustement nécessaire est documenté avant.*

## Risques et pièges

- ~~**Choix de l'identité :** trois industrielles pour une cible d'experts~~ : **levé le 10 novembre** : un profil d'expert indépendant est ajouté, avant les générations. Écart résiduel à dire : un profil fictif d'expert n'est pas un expert réel.
- ~~**Wharf est la société de Jacques**~~ : **levé le 10 novembre** : Wharf est exclue des identités, par décision antérieure aux générations (à documenter, pas à cacher : note dans `README.md`).
- **Biais de sélection :** avec `--runs 1`, une seule génération par identité, aucune sélection possible. Le dire explicitement.
- **Fiction présentée comme réel :** les trois profils de démonstration et leurs chiffres sont déclarés fictifs.
- **Sur-promesse :** aucune phrase du type « LinkedIn favorise », « échappe à l'AI slop », « mieux que ChatGPT ».
- **Preuve d'authenticité :** ne jamais afficher « génération réelle » en mode fixture.
- **Appel à l'action double :** le lien bêta doit rester hors du corps, sans quoi la cohérence « aucun appel commercial » des articles 1 et 2 se casse.
- **Indice de forme :** une personne peut apparier l'expert à sa première personne plutôt qu'à son fond : relever, ne pas corriger après coup.

## Calendrier

1. **Créer et figer le profil expert** : *fait côté code le 10 novembre* (nom fictif vérifié sans collision, mention « fictif » sur la page). Reste la relecture de Jacques et la **publication du gel** (`gel-demo-empreintes.md`), *avant toute autre étape*.
2. **Session unique avec `ANTHROPIC_API_KEY` visible** : les **quatre** générations de la démonstration (E4 est terminé, ses conditions C et D sont déjà générées). Base isolée, enregistrement complet, empreinte par génération, `--runs 1`, révocation de la clé ensuite (`session-generation-checklist.md`).
3. **La PR 344 est déjà fusionnée** (3 novembre 2026, page vide). Les changements de la v3 (Wharf retiré, expert ajouté, libellés) sont sur la branche `claude/funny-goodall-f2dvgs`, qui contient aussi les travaux E4 : une PR dédiée, limitée à la démonstration, seulement sur accord. **Avant tout déploiement, vérifier si `/demo-editoriale` est déjà en ligne** et dans quel état.
4. **Test avec 5 à 10 professionnels** (20 minutes chacun, pas d'amis proches) avant toute rédaction définitive.
5. **Rédaction de l'article 3** à partir des résultats, relecture contre le dossier de preuves.

## Ce dont il reste besoin

1. Une session avec `ANTHROPIC_API_KEY` visible, pour la démonstration uniquement (E4 est fait), après le gel.
2. Le profil expert **relu et figé** (gel publié) avant la session.
3. Une liste de 5 à 10 professionnels pour le test (pas d'amis proches).
4. La PR de mise à jour de la page pour quatre textes (trois profils + témoin) : code prêt sur la branche, à ouvrir sur demande.
