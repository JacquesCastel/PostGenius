# Protocole d'évaluation du moteur éditorial

Objectif : savoir, par la mesure, si des changements du moteur rendent les publications plus justes **sans** les rendre plus prudentes ou plus uniformes.

## Versions comparées (mêmes briefs, mêmes profils, mêmes paramètres)

| Version | Contenu |
|---|---|
| **A** | Moteur actuel (référence), non modifié |
| **B** | A + garde-fous factuels et correction des consignes contradictoires |
| **C** | B + champs éditoriaux courts construits avant le texte (dans le même appel), **seulement si B laisse un écart que C comble** |
| **D** | Témoin concurrentiel : Claude utilisé directement, même brief, même profil, sans l'orchestration LinkeePost |

Paramètres constants : modèle (`ANTHROPIC_MODEL`, défaut du moteur), `maxChars` 1300, `type` simple, langue fr, mêmes comptes d'évaluation (`scripts/eval-editorial.mjs setup`), profils Wharf / ASTER INDUSTRIE / AXIOME Conseil. Les comptes d'évaluation reprennent les profils de la démonstration **sans** la phrase « aucun chiffre inventé » (qui aiderait artificiellement le moteur).

## Jeux de briefs (`briefs.json`, figés avant toute modification)

- **explo** (6 briefs × 3 profils × 1 génération = 18 textes par version) : sert à comprendre et à régler.
- **val** (8 briefs × 3 profils × 2 générations = 48 textes par version) : distinct, lancé une seule fois par version retenue, jamais utilisé pour régler le moteur.
- Chaque brief liste les **faits établis** et ce qui est **non connu** (ne doit pas être affirmé). Catégories : industrie, RH et marque employeur, communication corporate, transformation, technique ou réglementaire, brief incomplet, brief contradictoire.

## Critères

1. **Bloquant — rigueur factuelle** : un texte qui affirme comme un fait un élément « non connu » n'est pas diffusable, quelle que soit sa note.
2. **Valeur éditoriale** (sur 100) : angle 25, fidélité à la marque et à la cible 25, raisonnement 20, rigueur 20, rédaction 10.
3. Une version n'est retenue que si elle réduit les inventions **et** ne dégrade pas significativement l'angle, la fidélité et le raisonnement, et garde les angles distincts d'un profil à l'autre.
4. Mesures automatiques : longueur, durée, tokens, coût estimé, détails à vérifier (chiffres, durées, citations, résultats ou causes absents du brief), similarité entre profils.

## Trois comportements à démontrer

Le critère de réussite global n'est pas « un meilleur rédacteur » mais un meilleur conseiller éditorial :

1. **Interpréter** : transformer un fait en angle pertinent pour une marque, une cible et une conviction.
2. **Sécuriser** : distinguer faits établis, hypothèses et inventions ; ne rien affirmer qui ne soit dans le brief.
3. **Conseiller** : savoir dire « ce sujet manque d'informations », « ces informations se contredisent, clarifiez avant de publier » ou « cet angle ne convient pas à votre marque ». Les briefs incomplets et contradictoires portent un champ `expectedAdvice` (ce qu'un conseiller attendrait). La relecture note un `jugement` : `publiable`, `a-verifier` ou `non-publiable`.

À distinguer lors de la conception : le **brouillon exploratoire** (l'utilisateur veut quelque chose à retravailler, une alerte suffit) et le **post publiable** (une affirmation non fondée est bloquante). Si exprimer ce conseil exige de changer le contrat de réponse (`text`, `extra`, `sources`, `why`), l'impact sera présenté et validé avant toute modification.

## Évaluation séparée du conseil (briefs incomplets et contradictoires)

Faite sur la **réponse originale complète** (post, `why`, commentaires), après la notation à l'aveugle des posts. Échelle 0 à 2, avec une justification courte :

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Détecter | aucun signal, ou paradoxe exploité comme matière | signal partiel ou implicite | information insuffisante ou contradictoire clairement identifiée |
| Conseiller | rien | indique le problème sans dire quoi faire | dit ce qui manque ou doit être vérifié |
| Décider | présente comme publiable un texte reposant sur des faits non établis, **même avec une note** | déconseille de publier tel quel de façon claire | refuse de présenter le texte comme publiable en l'état |

On précise toujours si l'avertissement est **accessible à l'utilisateur dans le fonctionnement normal** (visible dans l'écran) ou seulement dans une réponse technique (champ `why`, panneau fermé par défaut).

## Versions B et E (D+)

- **B** s'active par la variable d'environnement `EDITORIAL_ENGINE=B` sur le serveur ; sans elle, le moteur est exactement A (empreintes des prompts vérifiées par `scripts/engine-b.test.mjs`). B remplace le garde-fou anti-invention par la « frontière factuelle » (faits documentés, interprétations, informations manquantes), retire « une preuve, un exemple concret » du corps du post, et ajoute au contrat un champ **optionnel** `advisory` : `{ status: ready | verify | blocked, issue, toClarify[], recommendation }`, uniquement pour un post simple. Contrat existant (`text`, `extra`, `why`, `sources`) et interface inchangés ; `advisory` sert pour l'instant à mesurer la détection, pas à protéger la publication.
- **E (D+)** : Claude direct avec la même frontière factuelle, pour séparer l'effet de la règle de celui de l'orchestration. Ses analyses préalables (« classement des faits ») sont retirées du post et consignées comme commentaires pour l'évaluation du conseil.
- Commandes : `blind|sheet|conseilsheet --versions B,E` ne présentent que ces versions ; `import --kind scores|conseil --file` fusionne des notes exportées sans écraser les existantes.

## Relecture humaine ciblée avant B2

`node scripts/eval-editorial.mjs dossier` génère `data/eval-editorial/dossier-decision-B2.html` : neuf cas (AXIOME/transformation, industrie × 3, contradiction × 3, ASTER/réglementaire, ASTER/RH) avec les textes A, B, D et D+ côte à côte, le brief, les faits non établis et une grille de jugement distinguant invention factuelle significative, hypothèse légitime, manque d'information et choix de formulation. Les relevés préparatoires de l'assistant (`dossier-releves.json`) sont à confirmer par la relecture.

## Normalisation du témoin D

Claude utilisé directement entoure souvent le post d'une présentation, de séparateurs, d'un commentaire final, d'un compteur de caractères et de gras markdown. Ces éléments sont écartés à la lecture (`cleanDirect` dans le script) pour comparer les textes seuls. Le texte brut est conservé tel quel dans `results.jsonl`. Après nettoyage, D mesure 912 caractères en moyenne (contre 1 182 avant), soit une longueur comparable à A (972).

## Tests réglementaires datés

Le brief `explo-reglementaire` est un scénario fictif (le règlement a depuis été adopté) : il teste le respect d'un brief, pas la fiabilité réglementaire. Il reste dans le jeu de référence, non modifié. Un test réglementaire daté et sourcé, `val-reglementaire-date` (règlement (UE) 2025/40, vérifié le 2 novembre 2026), a été ajouté au jeu de validation.

## Données de test

Les comptes d'évaluation vivent dans une base jetable ; `data/eval-editorial/accounts.json` (mot de passe local, droits 600) est ignoré par Git et ne doit jamais être joint à un partage de résultats. La base jetable et ce fichier seront supprimés à la fin de l'évaluation.

## Relecture à l'aveugle

`node scripts/eval-editorial.mjs blind --set explo` mélange et anonymise les textes de toutes les versions. La clé est dans un fichier séparé, ouvert seulement après la notation. Les notes se saisissent dans `data/eval-editorial/scores-<jeu>.json`.

## Commandes

```bash
node scripts/eval-editorial.mjs setup                         # comptes d'évaluation (base jetable)
node scripts/eval-editorial.mjs run --version A --set explo   # une version sur un jeu
node scripts/eval-editorial.mjs blind --set explo             # feuille de relecture anonyme
node scripts/eval-editorial.mjs report --set explo            # synthèse par version
```

Les résultats bruts (`data/eval-editorial/`) ne sont pas versionnés et ne sont jamais réécrits.
