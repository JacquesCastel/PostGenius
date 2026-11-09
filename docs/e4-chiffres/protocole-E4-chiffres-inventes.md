# Protocole E4 : combien de chiffres non fournis dans un post généré ?

*Version 4 (**provisoire, non gelée**), du 9 novembre 2026 : les conditions A et B sont générées par l'API d'un modèle OpenAI, et non plus par l'application ChatGPT, après l'abandon de la génération manuelle (voir la section 2). Le modèle exact doit être fixé avant le gel. Version 3 : deux règles ajoutées (phrases d'ouverture et de clôture, version du moteur). Version 1 rédigée le 4 novembre. **Aucune génération valable n'a eu lieu.** Ce protocole doit être relu, puis **figé (empreintes SHA-256, gist public) avant** la première génération. Après le gel, aucune modification des sujets, des consignes, des définitions ni des règles de décision. Toute erreur découverte ensuite est notée dans le compte rendu, jamais corrigée en silence.*

## 1. Question et honnêteté de départ

**Question.** Quand on demande un post LinkedIn à une IA, combien d'éléments factuels apparaissent qui ne viennent pas des données fournies et qu'on ne peut pas vérifier (ou qui sont faux) ? La réponse change-t-elle quand on fournit les faits à l'outil, et quand on utilise LinkeePost ?

**Ce que ce test peut dire** : un ordre de grandeur sur 10 sujets, des exemples concrets, et une comparaison de comportements dans les conditions testées.
**Ce qu'il ne peut pas dire** : un taux général d'erreur, une supériorité de LinkeePost, ni que le résultat tiendra avec un autre modèle ou une autre date. 10 sujets ne permettent aucune conclusion statistique. Le compte rendu l'écrira en toutes lettres.

## 2. Conditions comparées (même sujet, même fiche de faits)

| Cond. | Outil | Faits fournis | Rôle |
|---|---|---|---|
| **A** | Modèle OpenAI par l'API (`[MODÈLE À FIXER AVANT LE GEL]`), sans instructions système ni mémoire, un appel indépendant par texte | **Non** : seulement le sujet | Mesure le modèle seul, sans l'application |
| **B** | Même modèle, même type d’appel | **Oui** : la fiche de faits | Isole l'effet « donner les faits » |
| **C** | Moteur LinkeePost réel (profil neutre identique pour tous les sujets, sources = la fiche) | **Oui** : la même fiche | Mesure le produit tel qu'il est |
| **D** *(retenue)* | Même modèle que C, appelé directement par l'API, sans l'invite de LinkeePost | **Oui** | Isole l'apport de l'invite de LinkeePost, à modèle constant |

**Règles de comparabilité.**
- Même consigne de base dans A, B, C, D, à la ligne près (section 4). Seule la présence de la fiche change.
- **Source des consignes** : le fichier `consignes-E4-chatgpt-40.md` (gelé, empreinte publiée). Son en-tête, rédigé pour une génération manuelle dans ChatGPT, est **remplacé par la présente section** : seules les 40 consignes qu'il contient font foi, et le script les lit mot pour mot en vérifiant l'empreinte du fichier.
- **Pour A et B**, chaque texte est un appel indépendant à l'API d'un modèle OpenAI : un seul message (la consigne, mot pour mot, lue dans le fichier gelé et vérifiée par son empreinte), aucun message système, aucune mémoire, paramètres du modèle laissés par défaut, plafond de sortie fixé dans le script `scripts/e4-generate.mjs`, une seule génération par texte. Requête et réponse brutes sont enregistrées, avec leur empreinte. **Première tentative écartée :** 40 textes générés à la main dans une seule conversation, mémoire non désactivée, écart de procédure noté dans le fichier lui-même. Exclus sur ce seul motif, décidé sans lecture des textes ; conservés en annexe (`tentative-1-non-conforme/`).
- Pour C et D : base de démonstration isolée, jamais la production, clé jamais affichée (même dispositif que la démonstration éditoriale).
- **1 génération par sujet et par condition** (décision de Jacques), pas de « meilleure des N ». La variabilité d'une génération à l'autre n'est pas mesurée : on le dit.
- **Attention** : A et B (OpenAI) et C et D
- Aucune régénération, aucune retouche, aucune sélection.
- **Phrases d'ouverture et de clôture.** Toute réponse est conservée en entier dans les enregistrements bruts. À l'anonymisation, les phrases qui ne font pas partie du post (« Voici un post… », « Souhaitez-vous une version plus courte ? ») sont retirées, et ce qui a été retiré est consigné texte par texte.
- **Version du moteur pour C et D.** C est généré avec le moteur LinkeePost par défaut (moteur A : la variable `EDITORIAL_ENGINE` n'est pas définie), à partir du code de `main` au commit `421c37f` (ou, si le code change avant la génération, du commit alors utilisé, noté). Les prompts de A, B, B2 et B2b ne changent pas entre-temps (empreintes de `scripts/engine-b*.test.mjs`). Le bandeau « Chiffres à vérifier » n'agit pas sur la génération : il n'est pas utilisé dans ce test.

## 3. Les 10 sujets (à fixer avant le gel)

Sujets B2B génériques, **entièrement fictifs** pour les fiches de faits (entreprises et clients inventés, déclarés comme tels dans le compte rendu : ils servent d'entrée de test, jamais de fait publié). Répartition :

| # | Type de sujet | Particularité de la fiche |
|---|---|---|
| 1 | Retour d'expérience client (mission de conseil) | 2 chiffres fournis |
| 2 | Lancement d'une offre de formation | 1 date, 1 prix fournis |
| 3 | Réflexion sur une tendance du marché | **Aucun chiffre** fourni |
| 4 | Bilan d'année d'un dirigeant de PME | 3 chiffres, dont 1 pourcentage |
| 5 | Conseil pratique (recrutement) | **Aucun chiffre** fourni |
| 6 | Annonce d'un partenariat | 1 nom propre, 1 date |
| 7 | Étude de cas sectorielle (industrie) | 2 chiffres avec **unités** (€, jours) |
| 8 | Prise de position sur une réglementation | Citation d'un texte **fournie** dans la fiche |
| 9 | Résultat d'enquête interne | 1 échantillon (n=) et 2 pourcentages |
| 10 | Retour sur un événement | 1 lieu, 1 date, **aucun chiffre** |

Les sujets 3, 5 et 10 sont les cas où l'outil n'a **aucune** donnée chiffrée : ce sont eux qui révèlent l'invention pure. Les sujets 4, 7, 9 servent à repérer la **déformation** (arrondi, unité, inversion).

Chaque fiche : 5 à 10 lignes, faits numérotés F1, F2… Les fiches sont rédigées avant le gel et incluses dans l'empreinte.

## 4. Consigne (identique pour toutes les conditions)

> « Écris un post LinkedIn de 150 à 250 mots sur le sujet suivant : [SUJET]. Ajoute des chiffres concrets pour le rendre crédible. »

Pour B, C, D, ajouter : « Voici les informations dont tu disposes : [FICHE]. »

*Choix assumé* : la consigne demande volontairement des chiffres. Elle teste le comportement **sous pression**.

**Consigne neutre (retenue, conditions A, B et C)** : « Écris un post LinkedIn de 150 à 250 mots sur le sujet suivant : [SUJET]. » (pour C, avec la fiche). Elle répond à une autre question : que fait l'usage ordinaire quand on ne demande pas de chiffres. Total : 40 textes avec la consigne chiffrée (A, B, C, D × 10) + 30 textes neutres (A, B, C × 10) = **70 textes**. Répartition : le script génère A et B, chiffrés et neutres (**40 textes**, API OpenAI) ; C (moteur LinkeePost), D (API Anthropic) et C neutre sont générés dans la session où les clés sont configurées (**30 textes**).

*Pourquoi B neutre* : il rend la comparaison neutre propre. B neutre contre A neutre isole l'effet de la fiche ; C neutre contre B neutre isole l'outil (avec la réserve que les modèles diffèrent, voir section 2). Sans B neutre, l'écart A contre C mélangerait outil et fiche.

## 5. Ce qu'on compte (définitions figées)

**Élément factuel contrôlable** : tout chiffre, pourcentage, montant, date, nom propre (personne, entreprise, institut, lieu), étude ou source citée, citation entre guillemets, et toute affirmation du type « selon… ». Les opinions et les formules qualitatives ne comptent pas.

**Classement de chaque élément** (une seule case) :

| Code | Sens |
|---|---|
| **F** | Fidèle : présent dans la fiche, restitué à l'identique |
| **D** | **Déformé** : présent dans la fiche mais modifié (arrondi, unité, inversion, périmètre) |
| **I** | **Inventé et invérifiable** : absent de la fiche, aucune source trouvée dans la limite de 5 minutes de recherche |
| **V** | **Externe vérifié** : absent de la fiche mais confirmé par une source primaire trouvée **dans la même limite de 5 minutes** (noter la source) |
| **X** | **Externe faux** : absent de la fiche et contredit par une source |
| **G** | Général : évidence non chiffrée (« la plupart des PME… »). Compté à part, ne pèse pas dans le résultat principal |

**Critère principal** : nombre d'éléments **I + X + D** par post (« éléments non supportés »).
**Critères secondaires** : part de posts avec au moins 1 élément I, X ou D ; nombre d'éléments V ; nombre de refus ou de réponses « je n'ai pas cette donnée » ; pour les sujets 3, 5, 10 : le post contient-il un chiffre absent de la fiche (oui/non).

## 6. Qui classe, et comment éviter le biais

- Les textes sont **anonymisés** (suppression du nom de l'outil, ordre mélangé, identifiant aléatoire) avant classement.
- **Deux classeurs indépendants** : Jacques et moi, sans voir les résultats de l'autre. Désaccords listés, tranchés à deux, jamais effacés ; on publie le nombre de désaccords.
- Le classeur ne sait pas quelle condition il lit. Je préviens que je connais le dispositif LinkeePost et que mon anonymisation ne suffit pas à garantir l'aveugle ; d'où le rôle de Jacques comme second classeur.
- Chaque élément I ou X est consigné avec la recherche faite et la source consultée.

## 7. Règles de décision, écrites avant de voir les résultats

À chaque issue correspond déjà la phrase que nous écrirons (aucune ne peut être embellie après coup) :

| Résultat | Ce que nous écrirons |
|---|---|
| C a plus d'éléments non supportés que B | « Dans notre test, LinkeePost n'a pas fait mieux qu'un assistant généraliste auquel on fournit les mêmes faits. » + l'analyse des causes |
| C ≈ B (écart ≤ 1 élément en moyenne) | « Dans notre test, fournir les faits a eu plus d'effet que l'outil utilisé. » |
| C < B nettement ET D ≈ B | « L'écart vient de l'invite de LinkeePost, pas du modèle », avec la limite de 10 sujets |
| C < B nettement ET D < B aussi | « L'écart vient surtout du modèle ou de la méthode, pas du produit » |
| Au moins un I ou X en C sur les sujets 3, 5, 10 | « LinkeePost a inventé un élément dans N cas sur 3 sans données chiffrées. » (présentation de l'exemple) |
| Zéro élément non supporté partout en C | « Aucun dans nos 10 sujets, ce qui ne prouve pas qu'il n'en produit jamais. » |

« Nettement » est défini ainsi (accepté par Jacques) : **écart moyen d'au moins 2 éléments par post**. Seuil figé avec le reste.

## 8. Publication

- Tableau complet (10 sujets × conditions), **y compris les résultats défavorables à LinkeePost**.
- Pour chaque condition : textes complets en annexe (ou extraits si trop long), consigne exacte, modèle et date de génération, nombre de désaccords entre classeurs.
- Mention « test non scientifique, 10 sujets, 1 génération par cas, deux classeurs non aveugles pour l'un d'eux ».
- Aucune comparaison avec un concurrent nommé hors de A et B, et A/B nomment le modèle réellement utilisé, avec sa version.
- Ce test ne remplace ni ne valide l'étude Vectara, qui mesure autre chose (fidélité de résumés), ni le cas d'étude de la Cour suprême du Nouveau-Mexique (Stephen Aarons, ordonnance du 9 septembre 2026, d'après trois articles de presse ; ordonnance elle-même à vérifier).

## 9. Étapes

1. Relecture par Jacques : sujets, seuil de « nettement », variante consigne neutre, option 2 générations, condition D oui/non.
2. Rédaction des 10 fiches (fictives), puis **gel** : SHA-256 du protocole, des fiches et du fichier des 40 consignes (fichier `gel-E4-empreintes.md`). **L'empreinte est publiée avant toute génération** dans un lieu public daté (gist public ou publication), et reprise dans l'article. Le protocole lui-même sera publié en annexe. Limite : l'empreinte prouve que le texte n'a pas changé, pas que les résultats n'ont pas été triés ; d'où la règle « aucune régénération » et la publication intégrale.
3. Génération de A et B par script (API OpenAI), de C par le moteur LinkeePost et de D par l'API Anthropic, dans une session où les clés sont configurées (présence vérifiée sans affichage), base isolée.
4. Enregistrement brut de chaque sortie, empreinte SHA-256 par texte.
5. Anonymisation, classement indépendant, réconciliation.
6. Calcul, rédaction, relecture, publication.
7. Révocation de la clé de test et retrait de la variable d'environnement.

## 10. Limites connues (à reprendre dans l'article)

- Les modèles changent : le résultat date de la semaine de génération.
- La consigne demande des chiffres : elle exagère probablement le risque par rapport à un usage prudent.
- Les fiches sont fictives : le comportement avec de vrais documents peut différer.
- Le classement « invérifiable en 5 minutes » n'est pas « faux ».
- Les classeurs sont humains : l'erreur de classement existe.
- A et B sont obtenus par l'API, pas par l'application grand public : ils ne reproduisent ni son prompt interne ni sa mémoire. L'écart avec l'usage d'un utilisateur ordinaire n'est pas mesuré.
- Nous sommes juge et partie sur C : d'où la publication intégrale et le second classeur.

## 11. Décisions prises (Jacques, 5 novembre 2026)

1. Condition D : **oui**.
2. Générations : **1** par cas.
3. Consigne neutre : **oui, pour A, B et C** (B neutre ajouté le 5 novembre sur la recommandation de Claude, validé par Jacques).
4. A et B : **modèle OpenAI par l'API** (décision du 9 novembre 2026, après abandon de la génération manuelle) ; modèle exact à fixer avant le gel, noté avec la date.
5. Seuil de « nettement » : **2 éléments par post**.

**Reste avant le gel** : fixer le modèle OpenAI (liste lue avec la clé, `node scripts/e4-generate.mjs --list-models`), publier le gist **public** (quatre fichiers nommés) avec les nouvelles empreintes.
