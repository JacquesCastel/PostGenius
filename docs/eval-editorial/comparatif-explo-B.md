# Comparatif apparié du jeu exploratoire : A → B et D → D+

18 paires (6 briefs × 3 marques), mêmes briefs, mêmes profils, une génération par version. Notation à l'aveugle par **un seul assistant IA** (non humain), en deux séances : A et D d'abord, B et D+ ensuite. Versions révélées après notation. Le décalage entre séances est un risque de dérive de barème. **Aucune conclusion avant relecture humaine des cas décisifs** (liste en fin de document).

## 1. Rigueur factuelle

| | A | B | D | D+ (E) |
|---|---:|---:|---:|---:|
| Rigueur moyenne /5 | 2,11 | **2,89** | 1,61 | **3,44** |
| Textes avec invention bloquante | 13 / 18 | **10 / 18** | 15 / 18 | **7 / 18** |
| Jugés publiables | 4 | 3 | 0 | 6 |

Bloquants par brief (A / B / D / D+) : industrie 3-3-3-3, RH 2-0-3-0, transformation 1-2-3-2, réglementaire 2-2-2-0, incomplet 2-1-1-0, contradictoire 3-2-3-2.

- **B progresse sur la rigueur** (+0,78, 3 bloquants de moins) mais reste loin de l'objectif fixé (au plus 3 bloquants sur 18).
- **La règle seule aide beaucoup plus chez Claude direct** : D → D+ passe de 15 à 7 bloquants et de 1,61 à 3,44. D+ fait mieux que B sur la rigueur.
- **Le brief industriel ne bouge pas du tout** : 12 textes sur 12, toutes versions, restent bloquants.
- **Contradictoire** : la rigueur de A (0,0) passe à 3,0 pour B et D+ : ils ne concilient plus les chiffres par une histoire inventée.

## 2. Conservation de l'intelligence éditoriale

| | A | B | D | D+ |
|---|---:|---:|---:|---:|
| Score éditorial /100 | 77,2 | **80,9** | 73,2 | 82,0 |
| Angle | 4,11 | **4,28** | 3,94 | 4,17 |
| Fidélité marque et cible | **4,89** | **4,89** | 4,56 | 4,50 |
| Raisonnement | 3,89 | 3,83 | 4,00 | 4,11 |
| Rédaction | 4,11 | 4,11 | 4,11 | 4,22 |
| Similarité entre profils (plus bas = plus distincts) | 0,119 | 0,126 | 0,125 | 0,146 |

- **A → B : 10 victoires, 4 défaites, 4 égalités**, sans perte sur l'angle ni sur la fidélité (4,89 des deux côtés). La singularité éditoriale est conservée. Sur 18 paires et un seul juge, ce n'est pas démontré statistiquement.
- **B garde son avantage de fidélité sur D+** (4,89 contre 4,50) et des profils plus distincts (0,126 contre 0,146). D+ gagne en rigueur et en raisonnement.

## 3. Conseil et blocage (12 cas sensibles)

| | A | B | D | D+ |
|---|---:|---:|---:|---:|
| Détecter /2 | 0,33 | **1,83** | 0,50 | **2,00** |
| Conseiller /2 | 0,00 | **1,33** | 0,50 | **1,33** |
| **Décider /2** | 0 | **0** | 0 | **0** |
| Avertissement visible par l'utilisateur | 0 / 6 | **0 / 6** | 0 / 6 | 6 / 6 (conversation) |

- Le champ `advisory` de B détecte presque tout (1,83) mais il est **invisible** : l'avertissement n'atteint pas l'utilisateur. Il ne protège rien, comme prévu pour cette phase.
- **`blocked` n'est jamais utilisé** (0 sur 18). Les 6 cas sensibles de B sont tous classés `verify`, plus 4 cas non sensibles.
- Aucune des 24 réponses (toutes versions) ne décide de ne pas présenter un texte comme publiable.
- Les analyses visibles de D+ sont lues dans la conversation, mais elles n'existeraient pas dans LinkeePost.

## 4. Coûts et durée

| | A | B | D | D+ |
|---|---:|---:|---:|---:|
| Coût moyen par texte | 0,0122 $ | 0,0166 $ (**+36 %**) | 0,0065 $ | 0,0107 $ (+65 %) |
| Durée moyenne | 12,6 s | 16,2 s (**+29 %**) | 9,0 s | 13,0 s (+44 %) |
| Tokens en entrée / sortie | 1 603 / 490 | 2 219 / 666 | 366 / 363 | 823 / 549 |

B dépasse le seuil fixé (±10 %). La cause est connue : consignes plus longues et sortie `advisory`.

## 5. Régressions de B à surveiller

- **`transformation | AXIOME`** : A 96 → B 86, raisonnement 5 → 3. C'est le cas que tu citais comme preuve de valeur. B glisse vers un diagnostic non établi, « à reformuler en question ».
- **`réglementaire | ASTER`** : rigueur 2 → 1. B nomme le texte et ajoute des obligations concrètes, par le biais de la clause « connaissances générales solides ». C'est une tension avec ta consigne : l'évaluateur les traite comme des inventions parce que le brief est fictif.
- **`transformation | Wharf`** : de non bloquant à bloquant (rigueur 4 → 2).
- **`incomplet | Wharf`** : angle 4 → 3 ; **`incomplet | ASTER`** : fidélité 5 → 4.
- D+ perd de la fidélité (5 → 4) sur 3 paires et s'uniformise davantage entre profils.

## 6. Corrections prioritaires à envisager pour B (sans rien modifier avant ton accord)

1. **Ajouter l'étape de classement de D+ dans le même appel.** L'effet de D+ vient probablement de ce que Claude écrit d'abord les trois listes (faits, interprétations, manquants). B se contente de la règle. Proposition : trois champs courts internes (`facts`, `interpretations`, `missing`) produits avant le texte, non affichés. C'est la version C dans sa forme la plus légère : elle est justifiée par la mesure, pas par principe.
2. **Règle de rôle de l'auteur.** Tous les textes industriels sont bloqués parce que le récit fait de l'auteur l'acteur (« nous avons identifié », « ASTER a proposé ») ou invente le suivi (« simplification retenue »). Consigne : ne parler à la première personne que si le brief dit que l'auteur est acteur ; sinon décrire la situation à la troisième personne ou en cas général.
3. **Resserrer la clause « connaissances générales ».** Tolérer les faits de portée générale, mais pas de noms de textes, chiffres, dates, obligations ou références précises sans source fournie. À valider avec toi, car cela réduit ce que tu avais ouvert.
4. **Calibrer `blocked`** : l'utiliser pour des informations contradictoires ou trop minces. Aujourd'hui il n'est jamais déclenché.
5. **Protéger ce qui marche** : les cas gagnants (RH, contradictoire) et l'avantage de fidélité. Le garde-fou « position claire et engagée » doit rester.
6. **Coût et durée** : après correction, raccourcir la consigne ; viser ±10 % ou justifier l'écart.

## 7. Cas décisifs à faire relire par un humain avant de conclure

| Cas | A | B | D | D+ | Question |
|---|---|---|---|---|---|
| transformation, AXIOME | TD63EE | T7D9E5 | TC4E99 | TE5FC4 | Régression de B réelle ou sévérité de séance ? |
| contradictoire, Wharf | TC8C96 | T48A59 | T1731F | TCF139 | +23 points : B concilie-t-il vraiment moins ? |
| industrie, 3 marques | T44E9A, TA7DF0, T03E7D | T42D98, T8B9C5, T70C5C | T322D6, T5897F, T82256 | T1138B, TEDEF1, T2DFAC | « Nous avons identifié… » est-il vraiment une invention, ou une lecture permise du brief ? |
| réglementaire, ASTER | TB35A3 | T4EA3B | T7C72F | T9ED5B | Le nom du texte relève-t-il de la connaissance fiable ? |
| contradictoire, ASTER et AXIOME | T8D13F, T80ABD | TD5270, TD5C56 | T4E635, TBC075 | T8F877, TD14AF | Aucun ne résout la contradiction ? |
| RH, ASTER | TC8C2B | TD1417 | T55BB4 | TB3342 | Passage de bloquant à non bloquant confirmé ? |

## 8. Limites
Un seul évaluateur (assistant IA), deux séances de notation, une génération par cas, trois profils partiellement synthétiques, brief réglementaire fictif. Les écarts de B sur A (+3,7 points, 3 bloquants de moins) sont encourageants, pas probants.
