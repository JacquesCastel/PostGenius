# Une IA qui écrit un post LinkedIn invente-t-elle des faits ? Notre test, ses résultats et ses limites

*Test non scientifique : 10 sujets, 1 génération par cas, un seul classeur, qui connaît l'outil évalué. Résultats du 10 novembre 2026.*

## En bref

Nous avons demandé à quatre dispositifs d'écrire le même post LinkedIn sur dix sujets fictifs, en leur demandant d'« ajouter des chiffres concrets pour le rendre crédible ». Nous avons ensuite relevé, texte par texte, chaque chiffre, date, nom propre ou source absents de la fiche de faits fournie.

- Sans les faits, le modèle généraliste a inventé ou déformé en moyenne **6,5 éléments par post**, dans les dix textes.
- Avec les faits, le même modèle en a encore inventé ou déformé **2,8 par post** (8 textes sur 10 en contiennent au moins un). Un second modèle, appelé directement avec les mêmes faits, a fait de même : **2,4**.
- **LinkeePost**, notre outil, a produit **0,3 élément non supporté par post** (2 textes sur 10).
- Quand on ne demande pas de chiffres, tous les dispositifs restent proches de zéro.

Dans notre test, l'écart vient de l'invite de LinkeePost et pas du modèle utilisé. Cette conclusion vaut pour dix sujets fictifs et une génération par cas. Le résultat dépend aussi de règles de comptage que nous détaillons plus bas, et qui peuvent réduire l'écart. Nous sommes juge et partie : c'est pourquoi tout est publié, y compris les textes et les écarts défavorables.

## Pourquoi ce test

Un outil d'écriture assistée par IA qui manque de matière a tendance à combler les vides : statistiques plausibles, clients imaginaires, dates précises. Nous voulions mesurer l'ampleur du phénomène dans des conditions simples, et voir si fournir les faits suffit, et si LinkeePost change quelque chose.

**Ce que ce test peut dire** : un ordre de grandeur sur dix sujets, des exemples concrets, une comparaison de comportements dans les conditions testées.
**Ce qu'il ne peut pas dire** : un taux général d'erreur, une supériorité générale de LinkeePost, ni que le résultat tiendra avec un autre modèle ou à une autre date.

## Méthode

**Dix sujets, dix fiches fictives.** Un retour de mission, un lancement de formation, une réflexion de marché, un bilan d'entreprise, un conseil de recrutement, un partenariat, une étude de cas industrielle, une prise de position sur une règle, une enquête interne, un salon. Chaque fiche contient quelques faits numérotés (F1, F2…). Trois sujets (3, 5 et 10) n'ont volontairement aucun chiffre : ce sont eux qui révèlent l'invention pure. Les entreprises, personnes et chiffres sont tous fictifs.

**Sept conditions, 70 textes.**

| Condition | Dispositif | Faits fournis | Consigne |
|---|---|---|---|
| A | modèle généraliste d'OpenAI, par l'API (`gpt-5.5-2026-04-23`) | non | chiffrée |
| B | le même modèle | oui | chiffrée |
| C | **LinkeePost** (moteur de génération, profil neutre identique pour tous les sujets) | oui | chiffrée |
| D | modèle d'Anthropic (`claude-sonnet-4-6`), par l'API, sans l'invite de LinkeePost | oui | chiffrée |
| AN, BN, CN | comme A, B, C | non, oui, oui | neutre |

La consigne chiffrée est : « Écris un post LinkedIn de 150 à 250 mots sur le sujet suivant : [sujet]. Ajoute des chiffres concrets pour le rendre crédible. » La consigne neutre est la même sans la dernière phrase. Quand les faits sont fournis, la fiche suit la consigne. Pour LinkeePost, la consigne est transmise comme thème et la fiche comme matière source. La condition D utilise le modèle de LinkeePost, appelé directement : elle isole l'effet de l'invite à modèle constant.

**Une génération par texte.** Aucune régénération, aucune retouche, aucune sélection. Les requêtes et réponses brutes sont conservées avec une empreinte SHA-256 par génération.

**Ce que les classeurs relèvent.** Tout chiffre, pourcentage, montant, date, nom propre, étude ou source citée, citation et affirmation du type « selon… » qui est absent de la fiche ou qui la modifie. Chaque élément reçoit un code :

| Code | Sens |
|---|---|
| F | fidèle à la fiche |
| D | déformé (arrondi, unité, inversion) |
| I | inventé et invérifiable : absent de la fiche, aucune source trouvée en 5 minutes de recherche |
| V | externe, vérifié par une source primaire dans la même limite |
| X | externe, faux |
| G | évidence non chiffrée, compté à part |

**Critère principal** : le nombre d'éléments I + X + D par post (« éléments non supportés »). Un élément I n'est pas forcément faux : il est absent de la fiche et nous n'avons pas pu le vérifier.

**Règles de décision écrites avant les résultats.** Une table associe à chaque issue la phrase que nous écrirons ; « nettement » signifie un écart moyen d'au moins 2 éléments par post, « équivalent » un écart d'au plus 1.

## Ce qui garantit que nous n'avons pas arrangé les résultats

Tout ce qui pouvait être figé l'a été, dans des gists publics datés, avant l'étape qu'il protège :

| Ce qui est figé | Quand | Avant |
|---|---|---|
| protocole, fiches, consignes, script de génération A, B, D (empreintes) | 9 novembre 2026, 15:14 UTC | toute génération (la première date de 15:40 UTC) |
| script et mode d'emploi de la condition C, valeur de longueur | 9 novembre 2026, 17:21 UTC | la génération de C (10 novembre, de 09:22 à 09:26 UTC) |
| empreinte de la clé d'anonymisation | 10 novembre 2026, 09:46 UTC | le classement |
| lecture de la table de décision | 10 novembre 2026, 10:03 UTC | l'ouverture de la clé |

Les adresses sont en fin de document. Une empreinte prouve qu'un texte n'a pas changé, pas que les résultats n'ont pas été triés : d'où la règle « une génération, aucune sélection » et la publication de tous les textes en annexe.

Les 70 textes ont ensuite été anonymisés (identifiant aléatoire, ordre mélangé, intitulés de type « # Post LinkedIn » retirés de 7 textes), puis classés avant l'ouverture de la clé.

## Résultats

### Moyenne d'éléments non supportés par post

| Condition | Éléments I + X + D (total sur 10 posts) | **Moyenne par post** | Posts avec au moins un | Éléments relevés au total |
|---|---|---|---|---|
| A, modèle OpenAI, sans les faits | 65 | **6,5** | 10 sur 10 | 67 |
| B, modèle OpenAI, avec les faits | 28 | **2,8** | 8 sur 10 | 64 |
| **C, LinkeePost** | **3** | **0,3** | **2 sur 10** | 33 |
| D, modèle Anthropic, avec les faits | 24 | **2,4** | 9 sur 10 | 57 |
| AN, neutre, sans les faits | 1 | 0,1 | 1 sur 10 | 1 |
| BN, neutre, avec les faits | 3 | 0,3 | 2 sur 10 | 35 |
| CN, neutre, LinkeePost | 2 | 0,2 | 2 sur 10 | 30 |

La condition AN produit presque aucun élément à contrôler (1 sur 10 textes) : sans faits ni demande de chiffres, le modèle écrit des textes génériques. Son 0,1 ne veut pas dire qu'il restitue les faits, mais qu'il n'en avance presque pas.

### Sujet par sujet (éléments I + X + D)

| Sujet | A | B | C | D | AN | BN | CN |
|---|---|---|---|---|---|---|---|
| 1 Mission de livraison | 9 | 1 | 0 | 2 | 0 | 0 | 0 |
| 2 Formation | 1 | 3 | 0 | 2 | 0 | 0 | 0 |
| 3 Traçabilité (sans chiffre) | 1 | 2 | 0 | 2 | 0 | 0 | 0 |
| 4 Bilan d'une menuiserie | 13 | 2 | 1 | 3 | 0 | 2 | 1 |
| 5 Recrutement (sans chiffre) | 6 | 7 | 2 | 5 | 1 | 0 | 0 |
| 6 Partenariat | 10 | 5 | 0 | 4 | 0 | 1 | 0 |
| 7 Four de fonderie | 9 | 0 | 0 | 2 | 0 | 0 | 0 |
| 8 Obligation d'origine des matières | 3 | 4 | 0 | 3 | 0 | 0 | 0 |
| 9 Enquête interne | 7 | 0 | 0 | 0 | 0 | 0 | 1 |
| 10 Salon (sans chiffre) | 6 | 4 | 0 | 1 | 0 | 0 | 0 |

Écarts par sujet, sur dix sujets : C a moins d'éléments non supportés que B dans 8 sujets, autant dans 2, jamais plus (écart moyen −2,5). Entre D et B, D a moins dans 5 sujets, autant dans 2, plus dans 3 (écart moyen −0,4). C a moins que D dans 9 sujets sur 10.

### Quels types de faits ?

Nous avons relevé tout fait contrôlable, quel qu'en soit le type, et pas seulement les chiffres. Répartition sur les 70 textes (tableau généré par `scripts/e4-types.mjs`, par condition dans `resultats/types-de-faits.md`) :

| Type de fait | Relevés | Inventés ou déformés |
|---|---|---|
| Chiffres, pourcentages, montants | 175 | 109 |
| Dates et durées | 30 | 16 |
| Noms propres | 77 | 1 |
| Citations | 4 | 0 |
| Études et sources citées | 1 | 0 |
| **Total** | **287** | **126** |

Dans ce test, l'invention a porté sur des chiffres et des dates. Presque aucun nom propre n'a été inventé, et il n'y a eu ni citation ni étude inventée. **Mais les citations et les sources sont rares dans ces textes (5 faits sur 287) : ce test ne permet presque rien de dire sur l'invention d'une citation ou d'une étude.**

### Ce que disent les règles de décision

- **Ligne appliquée** : C fait nettement mieux que B (écart de 2,5, seuil de 2) et D est proche de B (écart de 0,4, seuil de 1). Phrase prévue : « L'écart vient de l'invite de LinkeePost, pas du modèle », avec la limite de 10 sujets.
- **Sujets sans chiffre dans la fiche (3, 5, 10)** : LinkeePost a produit un élément non supporté dans 1 de ces 3 cas (sujet 5). Il faut présenter l'exemple : il s'agit de deux tournures d'illustration dans un récit (« six mois plus tard », « deux priorités contradictoires »), pas de données présentées comme des faits. Dans les conditions A, B et D, les trois sujets contiennent un chiffre absent de la fiche.
- Les trois éléments non supportés de C sont ces deux tournures et un hashtag contenant une année (`#Bilan2024`).

### Ce qui ne flatte pas LinkeePost

- Avec la consigne neutre, LinkeePost (CN) a produit deux déformations : « seize personnes » pour 17, et « près des trois quarts » pour 71 %.
- Les textes de LinkeePost contiennent moins d'éléments contrôlables que ceux de B (33 contre 64, dont 30 fidèles à la fiche contre 36). Avoir moins d'éléments non supportés vient donc en partie de textes moins chiffrés.
- La condition B, avec les mêmes faits que LinkeePost, a produit en moyenne 2,8 éléments non supportés, mais 12 de ses 28 éléments sont des chiffres d'exemple ou de conseil (voir l'analyse de sensibilité), pas des faits présentés comme réels.

### Exemples concrets

- **Condition A, sujet 4** (bilan d'une menuiserie, la fiche donne 2,4 M€ de chiffre d'affaires, +6 % et 17 personnes) : le modèle n'utilise aucun de ces faits et invente « 86 projets, dont 34 cuisines, 21 dressings et 12 escaliers », « 18 m³ de chêne », « 9 500 km » et une hausse de 17 % (texte T-7ZYT, annexe).
- **Condition A, sujet 6** (partenariat) : « 200 collaborateurs formés », « 92 % de satisfaction » sur « 25 participants » et un « partenaire » laissé entre crochets (T-8UC5).
- **Condition A, sujet 5** : « Une étude LinkedIn indique que les femmes postulent quand elles remplissent 100 % des critères, contre 60 % pour les hommes ». C'est le seul élément classé faux (X) parmi les 70 textes : le chiffre vient d'une remarque rapportée d'un cadre de Hewlett-Packard, pas d'une étude LinkedIn (T-58SN).
- **Condition D, sujet 3** (sans chiffre dans la fiche) : le modèle refuse la consigne (« je ne peux pas écrire ce post tel que demandé »), puis propose un post de remplacement qui contient lui-même « depuis 18 mois, chaque semaine… » (T-74TC). C'est l'unique refus des 70 textes.
- **Éléments vérifiés (V)** : quatre, tous dans A et D, par exemple le montant annuel de la commande publique française, vérifié sur les recensements officiels.

### Analyse de sensibilité

Nous avons compté comme non supportés des chiffres qui ne sont pas présentés comme des faits : paramètres de conseil (« 5 à 7 situations »), exemples illustratifs, plans d'action. Ils sont marqués dans la grille de classement. Sans eux :

| | A | B | C | D | AN | BN | CN |
|---|---|---|---|---|---|---|---|
| Moyenne I + X + D par post | 5,9 | 1,6 | 0,1 | 1,9 | 0,0 | 0,3 | 0,2 |

L'ordre des conditions ne change pas, mais l'écart entre C et B tombe à 1,5. Il se situe alors entre « équivalent » (au plus 1) et « nettement » (au moins 2) : les règles écrites à l'avance ne prévoient aucune phrase dans ce cas. Nous publions donc les deux chiffres, et la formule de la ligne 3 repose sur la façon de compter. Dans cette seconde lecture, l'écart avec les conditions A et D reste net (5,9 et 1,9 contre 0,1).

## Ce que cela veut dire, et ce que cela ne veut pas dire

**Ce que ces résultats autorisent à écrire.** Dans notre test, un modèle généraliste a inventé ou déformé des éléments factuels dans 8 à 10 posts sur 10 quand on lui demandait des chiffres, avec ou sans les faits. Fournir les faits a réduit l'invention de plus de moitié (de 6,5 à 2,8 éléments par post), sans la supprimer. LinkeePost en a produit très peu, et l'écart avec un modèle appelé directement avec les mêmes faits vient de l'invite, pas du modèle.

**Ce qu'ils n'autorisent pas.** Ils ne prouvent pas que LinkeePost n'invente jamais : dix sujets fictifs, une génération par cas. Ils ne mesurent pas l'usage réel de l'application ChatGPT ni de Claude, mais l'API de leurs modèles, sans leur invite interne ni leur mémoire.

## Limites

- **Un seul classeur, qui connaît le dispositif.** Le protocole prévoyait deux classeurs indépendants. Le second n'a pas eu lieu : décision de Jacques, le 10 novembre 2026. Il n'y a donc ni contrôle croisé ni mesure des désaccords, et le classeur sait quelle est la condition de LinkeePost. C'est la limite la plus importante.
- **Règles de comptage choisies par le classeur.** Quatre choix pèsent sur les chiffres : une année absente de la fiche compte comme élément inventé ; un calcul exact à partir de la fiche compte comme fidèle ; les chiffres de conseil et d'exemple comptent comme inventés ; un cas limite d'arrondi est classé déformé. Les onze règles sont publiées.
- **« Inventé » veut dire « invérifiable en 5 minutes ».** Un élément classé I n'est pas forcément faux.
- **Les modèles ne sont pas les mêmes.** A et B utilisent un modèle d'OpenAI, C et D un modèle d'Anthropic. La comparaison C contre D isole l'invite à modèle constant ; celle entre A, B et le reste ne le fait pas.
- **La consigne demande des chiffres.** Elle exagère probablement le risque par rapport à un usage prudent. Les conditions neutres, proches de zéro, le montrent.
- **Les fiches sont fictives.** Le comportement avec de vrais documents peut différer.
- **Dix sujets, une génération par cas.** La variabilité d'une génération à l'autre n'est pas mesurée. Aucun test statistique n'est calculé.
- **Le résultat date de la semaine de génération** (9 et 10 novembre 2026). Les modèles changent.
- **Nous sommes juge et partie** sur LinkeePost : d'où la publication intégrale.

## Écarts de procédure, tels qu'ils se sont produits

- Une première tentative a généré les 40 textes de A et B à la main dans une seule conversation d'une application de chat. Elle ne respectait pas le protocole (un texte par conversation neuve, mémoire désactivée). Elle a été écartée sans lecture des textes, et remplacée par des appels de l'API OpenAI par script.
- Le modèle OpenAI a été fixé avant la génération : `gpt-5.5-2026-04-23`, choisi parmi ceux qui répondaient le jour même (`gpt-6.1-sol` refusait l'appel).
- Les premiers gists étaient secrets, puis un gist public avec les empreintes a été publié avant toute génération valable.
- La génération de LinkeePost a nécessité des essais techniques : 18 enregistrements d'échec (clé d'API invalide, puis ancien processus du serveur de test), sans aucun texte produit. Ils sont conservés. Chaque texte a ensuite été généré une seule fois, après correction.
- La table de décision du protocole comportait un recouvrement et un trou. Notre lecture a été validée et publiée avant l'ouverture de la clé.
- Le second classement indépendant n'a pas eu lieu (voir plus haut).

## Reproduire et vérifier

- Les consignes, fiches, protocole, scripts de génération et leurs empreintes sont publiés dans les gists datés ; les scripts d'anonymisation, de classement et de calcul sont dans le dépôt du test ; chaque génération est enregistrée avec sa requête, sa réponse et son empreinte.
- Les 70 textes complets sont en annexe, avec la consigne exacte, le modèle et la date de génération de chaque condition.
- La grille de classement (287 éléments) et les résultats par texte sont publiés.

**Gists datés** : gel du protocole et des consignes (9 novembre 2026) : https://gist.github.com/JacquesCastel/6daaff4e0f2b2189ddaed9f773e28f40 ; complément pour la condition C : https://gist.github.com/JacquesCastel/368160e1e6526ee24aa7859a24e73fcd ; empreinte de la clé d'anonymisation (10 novembre, 09:46 UTC) : https://gist.github.com/JacquesCastel/41c20e687a80a696a8e8d4b6a74fed3f ; lecture de la table de décision (10 novembre, 10:03 UTC) : https://gist.github.com/JacquesCastel/126f38001743a04ecc3561e2b529af49

**Annexes** : `annexe-textes.md` (les 70 textes), `classement/grille-elements-claude.csv` (les 287 éléments), `resultats/resultats.md` et `resultats-sensibilite.md`, `protocole-E4-chiffres-inventes.md`.

---

## À vérifier avant publication (ne pas publier cette partie)

1. **Le dépôt est-il public ?** Les liens vers les fichiers du dépôt ne fonctionnent que s'il l'est, ou si les annexes sont jointes. Les quatre gists sont publics.
2. **Relire les formules de conclusion** : « l'écart vient de l'invite » ne doit pas être lu comme une supériorité générale. Le protocole interdit d'en écrire une.
3. **Le nom du produit** : décision de Jacques le 10 novembre 2026, on garde **LinkeePost** (nom du protocole, des gists, de l'article et du site). Vérifié : aucun document publiable ne dit autrement.
4. **Si l'article cite l'étude Vectara ou le cas de la Cour suprême du Nouveau-Mexique**, ajouter la mention du protocole : ce test ne les remplace ni ne les valide (l'ordonnance elle-même reste à vérifier).
5. **Révocation de la clé de test** et retrait de la variable d'environnement (étape 7 du protocole), à faire et à noter au journal : la clé Anthropic utilisée pour D et C, et la clé OpenAI. Supprimer aussi le `.env` de test sur le serveur.
6. **Une deuxième lecture indépendante** reste possible : si Jacques classe les 70 textes (page de lecture), le compte rendu pourra publier le nombre de désaccords et retirer sa première limite.
