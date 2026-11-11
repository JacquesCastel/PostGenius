# Journal de la mesure du contrôle des consignes (11 novembre 2026)

## Chronologie
1. **Protocole, corpus étiqueté et script commités avant toute exécution** (commit `0a3af2d`).
2. **Exécution 1** (conservée dans `execution-1/`). Consignes réelles du dépôt : 7 règles de type pris en charge retrouvées sur 7, aucune fausse règle. Formulations synthétiques : 24 retrouvées sur 29, **une fausse règle**.
3. **Défaut relevé en lisant le détail** : « Pas de hashtag dans le corps du texte » produisait la règle « aucun hashtag ». Or cette consigne n'interdit pas les hashtags en fin de post : le contrôle aurait signalé à tort un post conforme. C'est un **défaut de conception** (une consigne limitée à une partie du post était lue comme portant sur tout le texte), pas un réglage au corpus.
4. **Correction** : chaque consigne est lue dans sa propre proposition (séparée par une virgule). Une proposition limitée à une partie du post (corps, début, fin, titre, accroche, commentaires…), conditionnelle, ou suivie d'une exception (« sauf… ») ne produit aucune règle. Cinq tests de non-régression ajoutés.
5. **Exécution 2** (résultats du dossier) : voir le tableau.

| | Exécution 1 | Exécution 2 |
|---|---|---|
| Réel : règles retrouvées (type pris en charge) | 7 sur 7 | 7 sur 7 |
| Réel : fausses règles | 0 | 0 |
| Synthétique : retrouvées (type pris en charge) | 24 sur 29 | **25 sur 29** |
| Synthétique : fausses règles | **1** | **0** |

Le gain de rappel vient du même changement : « Pas d'émojis, tutoiement seulement sur les posts personnels » garde maintenant sa première consigne (S15). Ce n'est pas une amélioration visée : la lecture par proposition l'a produite. **Le corpus a servi à trouver le défaut et à vérifier la correction : il n'est plus un jeu indépendant.**

## Exécution 3 : deux manques comblés sur décision de Jacques (11 novembre 2026)
Jacques a demandé de lire la voix de la marque avant les consignes et d'ajouter « une question pour finir ». Changements, après les exécutions 1 et 2 (conservées dans `execution-1/` et `execution-2/`) :
- **« Terminer par une question »** : consigne explicite reconnue (« une question pour finir », « termine toujours par une question », « question finale »…), sauf négation (« pas de question finale »), condition ou exception. Contrôle : la dernière ligne portant du texte, sans hashtags ni émojis de fin, doit se terminer par « ? ». Niveau « à vérifier ».
- **Voix de la marque** : pour un post publié sur une page, elle est lue **en premier** et l'emporte sur les consignes personnelles pour le tutoiement ou le vouvoiement ; pour un post de profil, elle n'est pas lue (le prompt non plus). S'y ajoute le contrôle du prompt lui-même pour une page : « nous », jamais « je » (niveau « à vérifier »).

| | Exécution 2 | Exécution 3 |
|---|---|---|
| Réel : règles retrouvées | 7 sur 8 (la question finale manquait) | **8 sur 8** |
| Synthétique : retrouvées | 25 sur 31 | **26 sur 31** |
| Fausses règles | 0 | 0 |

L'étiquette `endsWithQuestion` du corpus, jusque-là « non prise en charge », devient prise en charge : le script a été modifié en conséquence. Les deux manques étaient connus avant ; ce n'est pas une mesure indépendante.

## Ce que montre la mesure
- **Sur les consignes que l'application propose elle-même** (« je tutoie mon audience, pas d'émojis, phrases courtes… »), le contrôle retrouve le tutoiement et le zéro émoji, sans fausse règle.
- **Manques de formulation (synthétique)** : « Évite les émojis » (formulation douce, choix de prudence), « Tu t'adresses directement au lecteur » (sans le mot tutoiement), « Ne dépasse jamais 3 hashtags » et « Limite-toi à 3 hashtags » (formulations claires, non reconnues).
- **Le mot interdit en texte libre** (« Jamais le mot « leader » ») n'est pas contrôlé ; seuls les mots validés dans « À éviter » le sont.

## Limites
- Un seul étiqueteur, auteur du contrôle. Corpus réel : 10 consignes, toutes du dépôt (aucune d'un vrai compte). Formulations synthétiques écrites par le même auteur.
- La lecture du champ `brandVoice` n'est pas mesurée par ce corpus (R07 ne teste que le texte) : elle est vérifiée par tests unitaires et lecture du code, pas sur de vrais profils.

## Pour mesurer sur de vraies consignes
`export-consignes.sql` : lecture seule, sans identifiant, à restreindre à des comptes de test ou consentants. Puis `node scripts/consignes-mesure.mjs --export fichier.csv` liste les règles obtenues pour chaque consigne, à relire à la main.
