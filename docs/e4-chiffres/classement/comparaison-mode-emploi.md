# E4 : comparer les deux classements (mode d'emploi)

Script : `scripts/e4-compare.mjs` (tests : `scripts/e4-compare.test.mjs`). **Il ne lit jamais la clé d'anonymisation** : il ne connaît aucune condition. À lancer seulement quand les deux classements sont terminés.

## Avant de lancer
Placer le classement de Jacques dans ce dossier, sous ces noms exacts :
- `grille-elements-jacques.csv` (copie remplie de `grille-elements-MODELE.csv`)
- `grille-textes-jacques.csv` (copie remplie de `grille-textes-MODELE.csv`)

## Lancer
```bash
node scripts/e4-compare.mjs
```
Autres noms de fichiers : `--jacques-elements`, `--jacques-textes`, `--claude-elements`, `--claude-textes`, `--out`. Seuil d'appariement des éléments : `--seuil 0.6` (de 0 à 1).

Le script vérifie d'abord les grilles (codes F/D/I/V/X/G, 70 textes, identifiants) et affiche ce qu'il faut corriger avant de conclure.

## Ce qu'il produit (dossier `comparaison/`)
| Fichier | Contenu |
|---|---|
| `rapport-comparaison.md` | Nombres d'éléments, appariés, codes différents, relevés par un seul classeur, accord et kappa de Cohen, textes dont le critère principal (I + X + D) diffère. **Aucune condition.** |
| `desaccords.csv` | Chaque écart, avec la citation, le code et la recherche des deux classeurs, et trois colonnes vides : décision à deux, code final, motif. |
| `grille-elements-finale.csv` | Tous les éléments ; code final **déjà rempli** quand les deux sont d'accord, **vide** sinon. |
| `grille-textes-finale.csv` | Refus et « chiffre absent », remplis quand les deux sont d'accord, vides sinon. |

## Types d'écart
- **code différent** : même élément, deux codes.
- **relevé par l'assistant seul** / **par Jacques seul** : un élément que l'autre n'a pas relevé, ou relevé autrement (un classeur regroupe « 18 → 7 », l'autre sépare 18 et 7). À trancher : le garder avec un code, ou mettre `ECART`.
- **refus différent** / **chiffre absent différent** : désaccord au niveau du texte.

## Règles du protocole (section 6)
Les désaccords sont **listés, tranchés à deux, jamais effacés**, et leur nombre est publié. Les lignes de `desaccords.csv` restent dans le dépôt après la décision.

## Limite
L'appariement est une heuristique (mêmes nombres et mots proches). Il peut séparer deux formulations du même élément : elles apparaissent alors comme deux « relevé par un seul », que la réconciliation regroupe. Il ne devine jamais un code.

## Ensuite
Quand `grille-elements-finale.csv` et `grille-textes-finale.csv` sont entièrement remplis : ouverture de la clé, puis calcul des résultats par condition et application des règles de décision (protocole, section 7).
