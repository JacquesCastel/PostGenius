# Article 10 — à coller dans Contenu du site → Blog → Nouvel article

## TITRE
Chiffres inventés dans les posts LinkedIn générés par IA : notre test et ses limites

## RÉSUMÉ (méta description)
Nous avons relevé les chiffres inventés dans 70 posts LinkedIn générés par IA, avec et sans les faits. Résultats, textes complets et limites du test.

## CONTENU (Markdown)
*Test non scientifique : 10 sujets, 1 génération par cas, un seul classeur, qui connaît l'outil évalué. Résultats du 10 novembre 2026.*

## En bref

Nous avons demandé à quatre dispositifs d'écrire le même post LinkedIn sur dix sujets fictifs, en leur demandant d'« ajouter des chiffres concrets pour le rendre crédible ». Nous avons ensuite relevé, texte par texte, chaque chiffre, date, nom propre ou source absents de la fiche de faits fournie.

- Sans les faits, le modèle généraliste a inventé ou déformé en moyenne **6,5 éléments par post**, dans les dix textes.
- Avec les faits, le même modèle en a encore inventé ou déformé **2,8 par post** (8 textes sur 10 en contiennent au moins un). Un second modèle, appelé directement avec les mêmes faits, a fait de même : **2,4**.
- **LinkeePost**, notre outil, a produit **0,3 élément non supporté par post** (2 textes sur 10).
- Quand on ne demande pas de chiffres, tous les dispositifs restent proches de zéro.

Dans notre test, l'écart vient de l'invite de LinkeePost et pas du modèle utilisé. Cette conclusion vaut pour dix sujets fictifs et une génération par cas. Le résultat dépend aussi de règles de comptage détaillées plus bas, qui peuvent réduire l'écart. Nous sommes juge et partie : c'est pourquoi tout est publié, y compris les textes et les écarts défavorables.

## Pourquoi ce test

Un outil d'écriture assistée par IA qui manque de matière a tendance à combler les vides : statistiques plausibles, clients imaginaires, dates précises. Nous voulions mesurer l'ampleur du phénomène dans des conditions simples, voir si fournir les faits suffit, et si LinkeePost change quelque chose.

**Ce que ce test peut dire** : un ordre de grandeur sur dix sujets, des exemples concrets, une comparaison de comportements dans les conditions testées.

**Ce qu'il ne peut pas dire** : un taux général d'erreur, une supériorité générale de LinkeePost, ni que le résultat tiendra avec un autre modèle ou à une autre date.

## Méthode

**Dix sujets, dix fiches fictives.** Un retour de mission, un lancement de formation, une réflexion de marché, un bilan d'entreprise, un conseil de recrutement, un partenariat, une étude de cas industrielle, une prise de position sur une règle, une enquête interne, un salon. Chaque fiche contient quelques faits numérotés (F1, F2…). Trois sujets (3, 5 et 10) n'ont volontairement aucun chiffre : ce sont eux qui révèlent l'invention pure. Les entreprises, personnes et chiffres sont tous fictifs.

**Sept conditions, 70 textes.**

- **A** : un modèle généraliste d'OpenAI, par l'API (`gpt-5.5-2026-04-23`), sans les faits, consigne chiffrée.
- **B** : le même modèle, avec la fiche de faits, consigne chiffrée.
- **C** : LinkeePost (son moteur de génération, avec un profil neutre identique pour tous les sujets), avec la fiche de faits, consigne chiffrée.
- **D** : un modèle d'Anthropic (`claude-sonnet-4-6`), par l'API, sans l'invite de LinkeePost, avec la fiche de faits, consigne chiffrée. C'est le modèle de LinkeePost, appelé directement : cette condition isole l'effet de l'invite à modèle constant.
- **AN, BN, CN** : comme A, B et C, avec une consigne neutre.

La consigne chiffrée est :

> « Écris un post LinkedIn de 150 à 250 mots sur le sujet suivant : [sujet]. Ajoute des chiffres concrets pour le rendre crédible. »

La consigne neutre est la même sans la dernière phrase. Quand les faits sont fournis, la fiche suit la consigne. Pour LinkeePost, la consigne est transmise comme thème et la fiche comme matière source.

**Une génération par texte.** Aucune régénération, aucune retouche, aucune sélection. Les requêtes et réponses brutes sont conservées, avec une empreinte SHA-256 par génération.

**Ce que le classeur relève.** Tout chiffre, pourcentage, montant, date, nom propre, étude ou source citée, citation et affirmation du type « selon… » qui est absent de la fiche ou qui la modifie. Chaque élément reçoit un code :

- **F** : fidèle à la fiche.
- **D** : déformé (arrondi, unité, inversion).
- **I** : inventé et invérifiable. L'élément est absent de la fiche et aucune source n'a été trouvée en 5 minutes de recherche. Il n'est pas forcément faux.
- **V** : externe, vérifié par une source primaire dans la même limite.
- **X** : externe, faux.
- **G** : évidence non chiffrée, comptée à part.

**Critère principal** : le nombre d'éléments I + X + D par post, que nous appelons « éléments non supportés ».

**Règles de décision écrites avant les résultats.** Une table associe à chaque issue la phrase que nous écrirons. « Nettement » signifie un écart moyen d'au moins 2 éléments par post, « équivalent » un écart d'au plus 1.

## Ce qui garantit que nous n'avons pas arrangé les résultats

Tout ce qui pouvait être figé l'a été, dans des gists publics datés, avant l'étape qu'il protège :

- **Le protocole, les fiches, les consignes et le script de génération** : figés le 9 novembre 2026 à 15:14 UTC, avant toute génération (la première date de 15:40 UTC).
- **Le script et le mode d'emploi de la condition LinkeePost** : figés le 9 novembre à 17:21 UTC, avant sa génération (le 10 novembre, de 09:22 à 09:26 UTC).
- **L'empreinte de la clé d'anonymisation** : publiée le 10 novembre à 09:46 UTC, avant le classement.
- **La lecture de la table de décision** : publiée le 10 novembre à 10:03 UTC, avant l'ouverture de la clé.

Les adresses sont en fin d'article. Une empreinte prouve qu'un texte n'a pas changé, pas que les résultats n'ont pas été triés : d'où la règle « une génération, aucune sélection » et la publication de tous les textes en annexe.

Les 70 textes ont ensuite été anonymisés (identifiant aléatoire, ordre mélangé, intitulés de type « # Post LinkedIn » retirés de 7 textes), puis classés avant l'ouverture de la clé.

## Résultats

### Éléments non supportés par post, par condition

- **A, modèle OpenAI sans les faits : 6,5 par post.** 65 éléments au total, présents dans 10 textes sur 10, 67 éléments relevés.
- **B, modèle OpenAI avec les faits : 2,8 par post.** 28 éléments au total, présents dans 8 textes sur 10, 64 éléments relevés.
- **C, LinkeePost : 0,3 par post.** 3 éléments au total, présents dans 2 textes sur 10, 33 éléments relevés.
- **D, modèle Anthropic avec les faits : 2,4 par post.** 24 éléments au total, présents dans 9 textes sur 10, 57 éléments relevés.
- **AN, neutre sans les faits : 0,1 par post.** 1 élément au total, 1 élément relevé en tout.
- **BN, neutre avec les faits : 0,3 par post.** 3 éléments au total, 35 éléments relevés.
- **CN, neutre, LinkeePost : 0,2 par post.** 2 éléments au total, 30 éléments relevés.

La condition AN produit presque aucun élément à contrôler : sans faits ni demande de chiffres, le modèle écrit des textes génériques. Son 0,1 ne veut pas dire qu'il restitue les faits, mais qu'il n'en avance presque pas.

### Sujet par sujet

Éléments non supportés pour chaque sujet, dans l'ordre A, B, C, D, puis les trois conditions neutres :

- **Sujet 1 (mission de livraison)** : A 9, B 1, C 0, D 2, AN 0, BN 0, CN 0
- **Sujet 2 (formation)** : A 1, B 3, C 0, D 2, AN 0, BN 0, CN 0
- **Sujet 3 (traçabilité, sans chiffre dans la fiche)** : A 1, B 2, C 0, D 2, AN 0, BN 0, CN 0
- **Sujet 4 (bilan d'une menuiserie)** : A 13, B 2, C 1, D 3, AN 0, BN 2, CN 1
- **Sujet 5 (recrutement, sans chiffre dans la fiche)** : A 6, B 7, C 2, D 5, AN 1, BN 0, CN 0
- **Sujet 6 (partenariat)** : A 10, B 5, C 0, D 4, AN 0, BN 1, CN 0
- **Sujet 7 (four de fonderie)** : A 9, B 0, C 0, D 2, AN 0, BN 0, CN 0
- **Sujet 8 (obligation d'origine des matières)** : A 3, B 4, C 0, D 3, AN 0, BN 0, CN 0
- **Sujet 9 (enquête interne)** : A 7, B 0, C 0, D 0, AN 0, BN 0, CN 1
- **Sujet 10 (salon, sans chiffre dans la fiche)** : A 6, B 4, C 0, D 1, AN 0, BN 0, CN 0

Sujet par sujet, LinkeePost a moins d'éléments non supportés que B dans 8 sujets, autant dans 2, jamais plus (écart moyen de 2,5). D a moins que B dans 5 sujets, autant dans 2, plus dans 3 (écart moyen de 0,4). LinkeePost a moins que D dans 9 sujets sur 10.

### Ce que disent les règles de décision

- **Ligne appliquée.** LinkeePost fait nettement mieux que B (écart de 2,5, pour un seuil de 2) et D est proche de B (écart de 0,4, pour un seuil de 1). La phrase prévue est : « L'écart vient de l'invite de LinkeePost, pas du modèle », avec la limite de 10 sujets.
- **Sujets sans chiffre dans la fiche (3, 5 et 10).** LinkeePost a produit un élément non supporté dans 1 de ces 3 cas (sujet 5). Il faut présenter l'exemple : ce sont deux tournures d'illustration dans un récit (« six mois plus tard », « deux priorités contradictoires »), pas des données présentées comme des faits. Dans les conditions A, B et D, les trois sujets contiennent un chiffre absent de la fiche.
- Les trois éléments non supportés de LinkeePost sont ces deux tournures et un hashtag contenant une année (`#Bilan2024`).

### Ce qui ne flatte pas LinkeePost

- Avec la consigne neutre, LinkeePost a produit deux déformations : « seize personnes » pour 17, et « près des trois quarts » pour 71 %.
- Les textes de LinkeePost contiennent moins d'éléments contrôlables que ceux de B (33 contre 64, dont 30 fidèles à la fiche contre 36). Avoir moins d'éléments non supportés vient donc en partie de textes moins chiffrés.
- La condition B, avec les mêmes faits que LinkeePost, a produit en moyenne 2,8 éléments non supportés, mais 12 de ses 28 éléments sont des chiffres d'exemple ou de conseil (voir l'analyse de sensibilité), pas des faits présentés comme réels.

### Exemples concrets

- **Condition A, sujet 4** (bilan d'une menuiserie, la fiche donne 2,4 M€ de chiffre d'affaires, +6 % et 17 personnes) : le modèle n'utilise aucun de ces faits et invente « 86 projets, dont 34 cuisines, 21 dressings et 12 escaliers », « 18 m³ de chêne », « 9 500 km » et une hausse de 17 %.
- **Condition A, sujet 6** (partenariat) : « 200 collaborateurs formés », « 92 % de satisfaction » sur « 25 participants » et un nom de partenaire laissé entre crochets.
- **Condition A, sujet 5** : « Une étude LinkedIn indique que les femmes postulent quand elles remplissent 100 % des critères, contre 60 % pour les hommes ». C'est le seul élément classé faux (X) parmi les 70 textes : le chiffre vient d'une remarque rapportée d'un cadre de Hewlett-Packard, pas d'une étude LinkedIn.
- **Condition D, sujet 3** (sans chiffre dans la fiche) : le modèle refuse la consigne (« je ne peux pas écrire ce post tel que demandé »), puis propose un post de remplacement qui contient lui-même « depuis 18 mois, chaque semaine… ». C'est l'unique refus des 70 textes.
- **Éléments vérifiés (V)** : quatre, tous dans A et D, par exemple le montant annuel de la commande publique française, vérifié sur les recensements officiels.

### Analyse de sensibilité

Nous avons compté comme non supportés des chiffres qui ne sont pas présentés comme des faits : paramètres de conseil (« 5 à 7 situations »), exemples illustratifs, plans d'action. Ils sont marqués dans la grille de classement. Sans eux, la moyenne d'éléments non supportés par post devient :

- **A** : 5,9
- **B** : 1,6
- **C (LinkeePost)** : 0,1
- **D** : 1,9
- **AN** : 0,0 ; **BN** : 0,3 ; **CN** : 0,2

L'ordre des conditions ne change pas, mais l'écart entre LinkeePost et B tombe à 1,5. Il se situe alors entre « équivalent » (au plus 1) et « nettement » (au moins 2) : les règles écrites à l'avance ne prévoient aucune phrase dans ce cas. Nous publions donc les deux chiffres, et la formule retenue plus haut repose sur la façon de compter. Dans cette seconde lecture, l'écart avec les conditions A et D reste net (5,9 et 1,9 contre 0,1).

## Ce que cela veut dire, et ce que cela ne veut pas dire

**Ce que ces résultats autorisent à écrire.** Dans notre test, un modèle généraliste a inventé ou déformé des éléments factuels dans 8 à 10 posts sur 10 quand on lui demandait des chiffres, avec ou sans les faits. Fournir les faits a réduit l'invention de plus de moitié (de 6,5 à 2,8 éléments par post), sans la supprimer. LinkeePost en a produit très peu, et l'écart avec un modèle appelé directement avec les mêmes faits vient de l'invite, pas du modèle.

**Ce qu'ils n'autorisent pas.** Ils ne prouvent pas que LinkeePost n'invente jamais : dix sujets fictifs, une génération par cas. Ils ne mesurent pas l'usage réel des applications grand public de ces modèles, mais leur API, sans leur invite interne ni leur mémoire.

## Limites

- **Un seul classeur, qui connaît le dispositif.** Le protocole prévoyait deux classeurs indépendants. Le second n'a pas eu lieu : c'est une décision prise le 10 novembre 2026. Il n'y a donc ni contrôle croisé ni mesure des désaccords, et le classeur sait quelle est la condition de LinkeePost. C'est la limite la plus importante.
- **Règles de comptage choisies par le classeur.** Quatre choix pèsent sur les chiffres : une année absente de la fiche compte comme élément inventé ; un calcul exact à partir de la fiche compte comme fidèle ; les chiffres de conseil et d'exemple comptent comme inventés ; un cas limite d'arrondi est classé déformé. Les onze règles sont publiées.
- **« Inventé » veut dire « invérifiable en 5 minutes ».** Un élément classé I n'est pas forcément faux.
- **Les modèles ne sont pas les mêmes.** A et B utilisent un modèle d'OpenAI, C et D un modèle d'Anthropic. La comparaison entre C et D isole l'invite à modèle constant ; celle entre A, B et le reste ne le fait pas.
- **La consigne demande des chiffres.** Elle exagère probablement le risque par rapport à un usage prudent. Les conditions neutres, proches de zéro, le montrent.
- **Les fiches sont fictives.** Le comportement avec de vrais documents peut différer.
- **Dix sujets, une génération par cas.** La variabilité d'une génération à l'autre n'est pas mesurée. Aucun test statistique n'est calculé.
- **Le résultat date de la semaine de génération** (9 et 10 novembre 2026). Les modèles changent.
- **Nous sommes juge et partie** sur LinkeePost : d'où la publication intégrale.

## Écarts de procédure, tels qu'ils se sont produits

- Une première tentative a généré les 40 textes de A et B à la main, dans une seule conversation d'une application de chat. Elle ne respectait pas le protocole (un texte par conversation neuve, mémoire désactivée). Elle a été écartée sans lecture des textes, et remplacée par des appels de l'API OpenAI par script.
- Le modèle OpenAI a été fixé avant la génération : `gpt-5.5-2026-04-23`, choisi parmi ceux qui répondaient le jour même (`gpt-6.1-sol` refusait l'appel).
- Les premiers gists étaient secrets ; un gist public avec les empreintes a été publié avant toute génération valable.
- La génération de LinkeePost a nécessité des essais techniques : 18 enregistrements d'échec (clé d'API invalide, puis ancien processus du serveur de test), sans aucun texte produit. Ils sont conservés. Chaque texte a ensuite été généré une seule fois, après correction.
- La table de décision du protocole comportait un recouvrement et un trou. Notre lecture a été validée et publiée avant l'ouverture de la clé.
- Le second classement indépendant n'a pas eu lieu (voir les limites).

## Reproduire et vérifier

Les consignes, fiches, protocole, scripts de génération et leurs empreintes sont publiés dans les gists datés ; les scripts d'anonymisation, de classement et de calcul sont dans le dépôt du test ; chaque génération est enregistrée avec sa requête, sa réponse et son empreinte. Les 70 textes complets, avec la consigne exacte, le modèle et la date de génération de chaque condition, la grille de classement (287 éléments) et les résultats détaillés sont en annexe : [annexes du test](https://gist.github.com/JacquesCastel/2bb20a046c7df003dd13765cf0924cf1).

Les quatre gists datés :

- [Gel du protocole, des fiches et des consignes](https://gist.github.com/JacquesCastel/6daaff4e0f2b2189ddaed9f773e28f40) (9 novembre 2026, 15:14 UTC)
- [Complément pour la condition LinkeePost](https://gist.github.com/JacquesCastel/368160e1e6526ee24aa7859a24e73fcd) (9 novembre 2026, 17:21 UTC)
- [Empreinte de la clé d'anonymisation](https://gist.github.com/JacquesCastel/41c20e687a80a696a8e8d4b6a74fed3f) (10 novembre 2026, 09:46 UTC)
- [Lecture de la table de décision](https://gist.github.com/JacquesCastel/126f38001743a04ecc3561e2b529af49) (10 novembre 2026, 10:03 UTC)
