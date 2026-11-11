# Journal de la mesure de « Chiffres à vérifier » sur E4 (11 novembre 2026)

## Chronologie
1. **Protocole et script commités avant toute exécution** (commit `b6709ad`).
2. **Exécution 1** (conservée dans `execution-1/`). Résultat : 77 chiffres I+X signalés sur 112.
3. **Anomalie relevée en lisant le détail** : la base de nombres de chaque sujet incluait par erreur les étiquettes de la fiche (« F1. », « F2. »…), c'est-à-dire les chiffres 1 à 6, comme si l'auteur les avait fournis. C'est une erreur de **mon script**, pas un réglage du contrôle : ces étiquettes ne font pas partie des informations. Elle faisait passer pour « coïncidant avec la fiche » des nombres comme « 3 menuisiers » ou « 1 apprenti ».
4. **Correction** : le préfixe `- Fn.` est retiré avant le calcul de la base. `lib/figureCheck.js` n'a pas été touché, ni les définitions du protocole.
5. **Exécution 2** (résultats du dossier) : 78 sur 112.

## Effet de la correction
| | Exécution 1 | Exécution 2 |
|---|---|---|
| Chiffres I+X signalés | 77 sur 112 | **78 sur 112** |
| Non signalés « coïncide avec la fiche » | 17 | **2** |
| Non signalés « ignoré par règle » | 18 | **32** |
| Fidèles signalés à tort | 7 sur 73 | 7 sur 73 |

Aucune autre valeur ne change. Le résultat de l'exécution 2 est celui à retenir ; l'exécution 1 reste archivée pour qu'on voie l'erreur.

## Lecture (brouillon, à relire)
- **Chiffres inventés ou faux** : 78 signalés sur 112 (69,6 %). Les 34 non signalés se partagent entre **32 ignorés par construction** (années isolées comme « En 2024 », nombres à un chiffre sans unité reconnue comme « 3 menuisiers ») et **2 qui coïncident avec un nombre de la fiche** (« 18 chauffeurs » face à « 18 retards » : l'unité « chauffeur » n'est pas reconnue). Hors nombres à un chiffre et années, le contrôle en signale 78 sur 80 (97,5 %).
- **Tous problèmes confondus** (I, X, D, avec ou sans chiffre) : 80 signalés sur 126 (63,5 %). Les 12 problèmes sans chiffre (9 inventés, 3 déformés : durées écrites en lettres, noms, citations) sont **hors de portée** du contrôle.
- **Fausses alertes** : 7 chiffres fidèles signalés sur 73 (9,6 %). Aucun n'est une erreur au hasard : « 2,4 M€ » face à « 2,4 millions d'euros » (format d'unité), « baisse de 61 % », « plus de 60 % », « environ 45 », « près de 15 » (nombres calculés à partir de la fiche), « 100 % présentielle » (paraphrase de « en présentiel »).
- **Au niveau du texte** : sur 29 textes ayant un problème chiffré, l'alerte s'affiche pour 27 (93,1 %) ; sur 36 textes sans aucun problème relevé, elle s'affiche pour 1 (2,8 %).
- **Condition C (moteur LinkeePost)** : un seul chiffre I+X dans les 10 textes, un hashtag (« #Bilan2024 », ignoré volontairement). Il y a trop peu de cas pour mesurer le contrôle sur le produit : les chiffres viennent surtout de A, B et D, générés hors moteur.
- **Condition A** : 59 des 112 chiffres. Le modèle n'a reçu aucune fiche et invente beaucoup de chiffres : elle pèse sur les moyennes.
- **Plafond de six** : 4 textes (tous en A) dépassent six signalements ; l'interface en montre six.

## Limites
Un seul classeur, qui connaît le dispositif ; 70 textes fictifs, 10 sujets ; une génération par cas ; 14 citations de la grille ne se retrouvent pas mot pour mot dans le texte (citation abrégée par le classeur) et ont été évaluées sur la citation seule ; le contrôle n'avait pas été conçu à partir de ces textes (dernière modification le 6 novembre, génération le 9), mais cela ne remplace pas un second jeu de textes.

## Phrase publiable, bornée (proposition)
« Dans notre test (70 textes fictifs, un seul classeur), le contrôle a signalé 78 des 112 chiffres classés inventés ou faux. Il ignore par construction les années et les nombres à un chiffre, qui font 32 des 34 oublis ; il a signalé à tort 7 des 73 chiffres fidèles, le plus souvent des chiffres calculés à partir des informations fournies ; il ne voit pas les 12 problèmes écrits sans chiffre. Il est indicatif. »
