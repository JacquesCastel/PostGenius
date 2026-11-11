# Mesure du contrôle « Chiffres à vérifier » sur les textes de E4 : protocole (avant les résultats)

Rédigé le 11 novembre 2026, **avant** d'exécuter le script. Ce document et `scripts/e4-mesure-figurecheck.mjs` sont commités avant la première exécution.

## Question
Sur les 70 textes de E4, le contrôle `lib/figureCheck.js` signale-t-il les nombres que le classement a codés inventés, faux ou déformés, et à tort les nombres fidèles à la fiche ?

## Ce qui est mesuré
- **Code du contrôle** : `lib/figureCheck.js` tel quel, non modifié depuis le 6 novembre 2026 (avant la génération de E4, commitée le 9 novembre) : les textes de E4 n'ont donc pas servi à le concevoir. Son empreinte SHA-256 est enregistrée à chaque exécution.
- **Informations fournies** : le corps de la fiche du sujet (lignes sous le titre, titre exclu), dans `docs/e4-chiffres/fiches-E4-fictives.md`.
- **Textes** : `anonymisation/textes-bruts-melanges.json` (70 textes). **Vérité de référence** : `classement/grille-elements-claude.csv` (un seul classeur, sans second classement : même limite que les résultats de E4).
- **Condition de chaque texte** : `resultats/detail-par-texte.csv`.

## Définitions figées
- **Élément chiffré** : un élément de la grille dont la citation contient au moins un chiffre (tout type).
- **Problème** : élément codé **I** (inventé), **X** (externe faux) ou **D** (déformé). Rappel : I et X d'un côté, D de l'autre, sont rapportés séparément.
- **Signalé** : le contrôle signale au moins un nombre dont la valeur appartient à la citation de l'élément (le contexte analysé est la citation plus 16 caractères qui la suivent, pour lire l'unité).
- **Alerte sur un texte** : le contrôle signale au moins un nombre dans le texte entier, avec le plafond de six du produit.
- **Rappel** : éléments chiffrés I+X signalés / éléments chiffrés I+X. **Fausse alerte** : éléments chiffrés **F** signalés / éléments chiffrés F.
- Les éléments **V** (absents de la fiche mais confirmés) sont rapportés à part : les signaler est conforme à la définition du contrôle, ce n'est pas une erreur.
- **Invisibles** : éléments I, X ou D **sans aucun chiffre** (nom, durée écrite en lettres, citation). Le contrôle ne peut pas les voir : ils sont comptés pour dire la part de problèmes hors de sa portée.
- **Causes des non-signalés** (problèmes chiffrés) : « nombre coïncidant avec un nombre de la fiche », « ignoré par règle (année, nombre à un chiffre sans unité comptée) », « autre ».

## Règles contre l'auto-flatterie
1. Les résultats sont publiés **quels qu'ils soient**, y compris un rappel faible.
2. Aucune modification de `figureCheck.js`, du script ou des définitions après la première exécution sans la consigner dans le journal, avec les deux résultats.
3. Une citation qui ne se retrouve pas dans le texte est comptée et signalée, jamais écartée.
4. Découpage par condition : A (sans fiche pour le modèle), B (fiche, modèle seul), C (moteur LinkeePost), D (fiche, modèle sans l'invite), et variantes neutres.

## Limites à publier avec le résultat
Un seul classeur ; 70 textes, 10 sujets, entités fictives ; une génération par cas ; les sujets S3, S5 et S10 n'ont aucun chiffre dans la fiche, ce qui rend toute présence de nombre suspecte par construction ; le contrôle est indicatif et ne voit pas ce qui n'est pas un nombre.
