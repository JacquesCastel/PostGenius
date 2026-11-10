# E4 : comment le script applique la table de décision (à valider AVANT d'ouvrir la clé)

Script : `scripts/e4-resultats.mjs` (tests : `scripts/e4-resultats.test.mjs`, sur des données fictives : les tests ne lisent jamais la vraie clé). Rédigé le 10 novembre 2026, **avant** tout calcul par condition. La table de la section 7 du protocole a deux défauts quand on l'applique à la lettre. Cette note fixe la lecture retenue, pour qu'elle ne puisse pas être choisie après avoir vu les chiffres.

## Ce que le protocole fixe (inchangé)
- Critère principal : nombre d'éléments **I + X + D** par post, moyenne sur les 10 sujets, par condition.
- « Nettement » = écart moyen d'**au moins 2** éléments par post ; « ≈ » = écart de **1 au plus** en moyenne.
- Comparaisons de la table : **C contre B**, puis **D contre B**, sur les conditions **chiffrées** (A, B, C, D). Les conditions neutres (AN, BN, CN) sont présentées à côté, sans règle de décision.

## Défaut 1 : recouvrement des lignes 1 et 2
Ligne 1 : « C a plus d'éléments non supportés que B ». Ligne 2 : « C ≈ B (écart ≤ 1) ». Si C dépasse B de 0,5, les deux lignes disent vrai, avec des phrases contraires.
**Lecture retenue** : la ligne 2 définit l'équivalence, la ligne 1 s'applique seulement quand C dépasse B **de plus de 1**.

## Défaut 2 : trou entre « ≈ » et « nettement »
Si C est meilleur que B de 1,5 (entre 1 et 2), aucune ligne ne s'applique.
**Lecture retenue** : le script le dit (« écart intermédiaire »), ne choisit aucune formule, et le compte rendu publie les chiffres sans formule.

## Conséquences pour D (lignes 3 et 4)
- « D ≈ B » (ligne 3) : écart absolu d'au plus 1. « D < B aussi » (ligne 4) : D meilleur que B d'**au moins 2**.
- Si C est nettement meilleur mais que D est dans l'intervalle intermédiaire, ou pire que B de plus de 1, aucune des lignes 3 et 4 ne s'applique : le script le signale, sans formule.

## Lignes 5 et 6
- Ligne 5 : au moins un **I ou X** (pas D) dans C sur les sujets 3, 5 et 10. N = nombre de ces trois sujets concernés.
- Ligne 6 : **zéro** élément non supporté (I + X + D) dans les 10 textes de C.
- Ces deux lignes peuvent s'appliquer en plus de l'une des lignes 1 à 4.

## Garde-fous du script
- Il refuse de calculer tant qu'un code final ou une case refus / chiffre absent est vide : aucun résultat partiel.
- Les éléments marqués `ECART` sont exclus du calcul (décision à deux, consignée).
- Il affiche l'empreinte de la clé lue, qui doit être `6fb57b2ef45d1dabec487beac90cfe2d2ba39200ec7c264860609bf5ee619e99`.
- Le tableau complet 10 sujets × 7 conditions, les écarts par paires et les résultats défavorables sont publiés dans tous les cas.
- **Analyse de sensibilité** (facultative) : `--sans-etiquettes CONSEIL,EXEMPLE,PLAN` retire du calcul les chiffres de conseil, d'exemple ou de plan (voir `classement/regles-appliquees-claude.md`). Elle ne remplace pas l'analyse principale et ne fixe aucune phrase de la table.

## Ce que le script ne fait pas
Aucun test statistique : le protocole n'en prévoit pas, et le test est dit « non scientifique, 10 sujets, 1 génération par cas ». Il donne les écarts moyens et, par sujet, le nombre de cas où chaque condition fait mieux.

## Validation
**Validée par Jacques le 10 novembre 2026** : lecture des deux défauts (recouvrement des lignes 1 et 2, trou entre « ≈ » et « nettement ») approuvée telle qu'écrite ci-dessus, avant tout calcul par condition et avant l'ouverture de la clé.
Reste à faire : publier cette note dans un gist public daté, avec son empreinte SHA-256, **avant** l'ouverture de la clé.
