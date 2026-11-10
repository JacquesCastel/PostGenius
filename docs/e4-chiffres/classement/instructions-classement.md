# E4 : instructions de classement (version à remplir, deux classeurs indépendants)

Ces instructions reprennent mot pour mot les définitions figées du protocole (sections 5 et 6). En cas de doute, le protocole fait foi.

## Ce que vous recevez
- `../anonymisation/lot-classement.md` : 70 textes anonymisés, groupés par sujet (S01 à S10), la fiche de faits du sujet en regard. La condition n'est pas indiquée.
- `grille-textes-MODELE.csv` : une ligne par texte, déjà numérotée.
- `grille-elements-MODELE.csv` : une ligne par élément factuel relevé (vide au départ).

**Copiez les deux modèles sous votre nom** (`grille-textes-VOTRENOM.csv`, `grille-elements-VOTRENOM.csv`) et ne travaillez que sur vos copies. Ne regardez pas la grille de l'autre classeur avant d'avoir terminé la vôtre. **N'ouvrez pas** le dossier `../anonymisation/NE-PAS-OUVRIR-avant-classement/`.

Les fichiers s'ouvrent dans un tableur (séparateur : point-virgule, encodage UTF-8).

## Ce qu'on relève : les éléments factuels contrôlables
Tout chiffre, pourcentage, montant, date, nom propre (personne, entreprise, institut, lieu), étude ou source citée, citation entre guillemets, et toute affirmation du type « selon… ». Les opinions et les formules qualitatives ne comptent pas.

## Le code de chaque élément (une seule case)
| Code | Sens |
|---|---|
| **F** | Fidèle : présent dans la fiche, restitué à l'identique |
| **D** | **Déformé** : présent dans la fiche mais modifié (arrondi, unité, inversion, périmètre) |
| **I** | **Inventé et invérifiable** : absent de la fiche, aucune source trouvée dans la limite de 5 minutes de recherche |
| **V** | **Externe vérifié** : absent de la fiche mais confirmé par une source primaire trouvée dans la même limite de 5 minutes (noter la source) |
| **X** | **Externe faux** : absent de la fiche et contredit par une source |
| **G** | Général : évidence non chiffrée (« la plupart des PME… »). Compté à part, ne pèse pas dans le résultat principal |

Critère principal : nombre d'éléments **I + X + D** par post. Chaque élément I ou X est consigné avec la recherche faite et la source consultée.

## Comment remplir
1. Pour chaque texte, relevez les éléments un par un dans `grille-elements-…csv` : `id_texte`, numéro, citation exacte, type, code. Pour F et D, indiquez la ligne de la fiche (F1, F2…). Pour I, V, X, notez la recherche faite et la source.
2. Les éléments externes réels (loi, institut, statistique, lieu) se vérifient dans la limite de 5 minutes.
3. Dans `grille-textes-…csv` : indiquez pour chaque texte si c'est un **refus** ou un « je n'ai pas cette donnée » (oui/non) ; pour les sujets S03, S05 et S10, si le texte contient **un chiffre absent de la fiche** (oui/non) ; le nombre d'éléments relevés ; vos remarques.
4. Ne corrigez pas un classement après avoir vu celui de l'autre classeur : les désaccords sont listés puis tranchés à deux, jamais effacés, et leur nombre est publié.
5. Notez l'heure de début et de fin de votre classement (dans vos remarques du premier et du dernier texte).

## Précision proposée par l'assistant, NON prévue par le protocole (à valider par Jacques avant le classement)
Les entreprises, personnes et chiffres des fiches sont **fictifs**. Proposition : un élément absent de la fiche et qui concerne ces entités fictives (un chiffre, une date, un nom attribué à « Maison Bellange », par exemple) est classé **I**, sans recherche, puisqu'il n'existe nulle part ailleurs. Si cette précision n'est pas retenue, chaque classeur applique la règle des 5 minutes telle quelle, et on le note.

## Limite
La mise en forme d'un texte trahit parfois son origine. Si vous croyez reconnaître une condition, notez-le dans les remarques sans en tenir compte pour le code.
