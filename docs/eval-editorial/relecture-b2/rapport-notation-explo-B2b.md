# Évaluation B2b — jeu exploratoire (deux lectures de conseil, une lecture des textes)

## Périmètre et limites

30 publications notées à l’aveugle avant de révéler les versions : 24 nouvelles générations B2b (18 cas principaux + 6 répétitions sensibles) et 6 ancres A/B. Les 12 avis B2 et 12 avis B2b ont été évalués séparément. Les 3 avis B2 déjà renseignés ont été conservés inchangés. Les notes restent celles **d’un assistant IA**, non une validation humaine indépendante. La sévérité de notation varie entre séances ; l’analyse des ancres ci-dessous prime sur toute lecture naïve des moyennes.

## Résultats éditoriaux

| Mesure | B2b principaux (18) | B2b toutes générations (24) |
|---|---:|---:|
| Score éditorial moyen /100 | 79.22 | 77.38 |
| Angle /5 | 4.06 | 3.96 |
| Fidélité /5 | 4.94 | 4.92 |
| Raisonnement /5 | 3.78 | 3.67 |
| Rigueur /5 | 2.78 | 2.58 |
| **Invention bloquante** | **10/18** | **15/24** |
| Publiable sans correction | 2/18 | 2/24 |

La cible B2b héritée de B2 (≤ 6 inventions/18 ; rigueur ≥ 3,4) **n’est pas atteinte** : 10/18, rigueur 2,78. L’angle, la fidélité et le raisonnement restent respectivement 4,06, 4,94 et 3,78, compatibles avec les minima fixés. Le raisonnement sur AXIOME/transformation est évalué **5/5** ; ce bon lien entre planification et besoin achats est conservé. Sur la partie délicate (les six secondes générations), 5/6 publications ont une invention significative selon cette lecture.

## Audit après rédaction et fiabilité de `ready`

| Mesure (un texte = une unité) | 18 principales | 24 générations |
|---|---:|---:|
| Audit TP | 3 | 6 |
| Audit FP | 1 | 2 |
| Audit FN | 7 | 9 |
| Audit TN | 7 | 7 |
| **Rappel parmi les textes avec invention** | **3/10 = 30%** | **6/15 = 40%** |
| Précision au niveau du texte (audit signale au moins un passage) | 3/4 = 75% | 6/8 = 75% |
| Inventions malgré `ready` | 2/3 ready | 2/3 ready |
| Textes avec invention correctement non-`ready` | 8/10 = 80% | 13/15 = 87% |

La précision et le rappel ci-dessus sont **au niveau du texte**, et non une validation de la pertinence de chaque citation. Exemple de faux positif : `T827F4` signale « La crédibilité se construit aussi en interne », qui est une conviction éditoriale acceptable. `T01F1C` signale comme fait un risque conditionnel général. `T2BD49` signale une pratique de dialogue en amont qui peut être appuyée par le profil (faux positif au niveau de l’extrait, bien que le texte contienne d’autres problèmes). À l’inverse, `T274E6` n’est pas signalé par l’audit alors que le post tranche « Pas une erreur, une question de périmètre ».

**Conclusion sur l’audit :** il ne constitue pas un contrôle indépendant et rate la majorité des textes jugés bloquants. Le statut `ready` reste trop optimiste : deux des trois textes `ready` contiennent une invention dans notre lecture (cas `T6B66A`, `T2143C`). Sur les 18 cas principaux, l’objectif de ≥ 85 % de textes inventés non-`ready` est **manqué (80 %)** ; il est atteint seulement sur les 24 textes combinés (87 %), grâce aux répétitions.

## Détection, conseil et décision : 12 cas B2 et 12 B2b

| Critère (/2) | B2 (12 cas) | B2b (12 cas) |
|---|---:|---:|
| Détecter | 2.00 | 2.00 |
| Conseiller | 1.50 | 1.75 |
| Décider | 0.50 | 0.50 |

Les 12 avis de chaque version reconnaissent le problème initial (prix insuffisamment précisé ou chiffres contradictoires) ; les avis B2b citent parfois des passages exacts du texte. Mais `advisory` demeure **non visible** pour l’utilisateur, même sur les états `blocked`. L’échelle utilisée attribue `decider=1` à un blocage **technique interne** (six cas de contradiction par version) et `decider=0` à un simple `verify` ; **aucun avis n’obtient 2**, car aucun ne bloque réellement la diffusion dans l’application. Les moyennes de conseil ne doivent donc pas être interprétées comme une sécurité opérationnelle.

## Contrôle des six ancres et dérive du barème

| Identifiant nouvelle séance | Version | Identifiant ancien | Note précédente | Note actuelle | Écart | Bloquant ancien → actuel |
|---|---|---|---:|---:|---:|---|
| `TF0505` | B | `T42D98` | 73 | 76 | +3 | oui → non |
| `TD4155` | A | `TA7DF0` | 73 | 73 | +0 | oui → oui |
| `T9F392` | B | `TD1417` | 85 | 77 | -8 | non → oui |
| `T2C332` | A | `T5FCCC` | 85 | 81 | -4 | non → non |
| `T81ABE` | A | `T030CB` | 77 | 73 | -4 | oui → oui |
| `T487D8` | B | `T60E12` | 82 | 80 | -2 | oui → oui |

Dérive moyenne : **-2.5/100**, écart absolu moyen **3.5**. Deux ancres changent de classification bloquante, dans des directions opposées. Une correction globale de la note B2b de +2,5 points n’est **qu’une indication**, pas une recalibration scientifique. Les versions ne doivent pas être hiérarchisées sur un petit écart de moyenne.

## Performance et décision

Sur les mesures mécaniques communiquées par Claude Code : coût B2b **0,0218 $/texte**, contre 0,0122 $ pour A (+79 %) ; latence **23,5 s**, contre 12,6 s (+87 %). Ces mesures échouent la cible historique de +25 %. Les 3 contradictions primaires sont bien `blocked` et les 3 briefs incomplets au moins `verify`, mais les alertes non sensibles sont nombreuses : **9/12** non-`ready` (objectif ≤ 4/12).

**Décision recommandée :** B2b ne franchit pas les seuils éditoriaux et économiques ; ne pas lancer de B2c ni de validation finale du moteur B2b. Réexaminer l’architecture avant codage : rédaction fondée sur le profil et la marque, suivi d’une vérification indépendante ou d’un parcours explicite de revue/publication. Conserver le moteur A intact. Le signal le plus décisif n’est pas la moyenne : `ready` reste faux pour 2 textes sur 3 et le post peut affirmer la cause d’une contradiction que le classement sait ne pas connaître.

## Notes individuelles (30 textes)

| ID | Version (révélée après notation) | Brief / profil | Score | Rigueur | Bloquant | Jugement |
|---|---|---|---:|---:|---|---|
| `TEEFDE` | B2b | industrie / wharf | 74 | 4 | non | a-verifier |
| `TF0505` | B | industrie / wharf | 76 | 4 | non | a-verifier |
| `T58594` | B2b | industrie / aster | 73 | 1 | oui | a-verifier |
| `TD4155` | A | industrie / aster | 73 | 1 | oui | a-verifier |
| `TDD2F3` | B2b | industrie / axiome | 90 | 4 | non | publiable |
| `T3F7B3` | B2b | rh / wharf | 89 | 5 | non | publiable |
| `T6B66A` | B2b | rh / aster | 81 | 3 | oui | a-verifier |
| `T9F392` | B | rh / aster | 77 | 2 | oui | a-verifier |
| `T167C8` | B2b | rh / axiome | 81 | 3 | oui | a-verifier |
| `T2C332` | A | transformation / wharf | 81 | 3 | non | a-verifier |
| `T80A3A` | B2b | transformation / wharf | 81 | 3 | oui | a-verifier |
| `T2143C` | B2b | transformation / aster | 69 | 1 | oui | non-publiable |
| `T81ABE` | A | transformation / aster | 73 | 1 | oui | a-verifier |
| `T2C7D4` | B2b | transformation / axiome | 96 | 4 | non | a-verifier |
| `TA34D5` | B2b | reglementaire / wharf | 87 | 4 | non | a-verifier |
| `T01F1C` | B2b | reglementaire / aster | 85 | 4 | non | a-verifier |
| `T2CF0D` | B2b | reglementaire / axiome | 90 | 4 | non | a-verifier |
| `T487D8` | B | reglementaire / axiome | 80 | 1 | oui | non-publiable |
| `T28852` | B2b | incomplet / wharf | 85 | 4 | non | a-verifier |
| `T827F4` | B2b | incomplet / wharf | 85 | 4 | non | a-verifier |
| `T3543A` | B2b | incomplet / aster | 73 | 1 | oui | a-verifier |
| `TEAE0F` | B2b | incomplet / aster | 69 | 1 | oui | a-verifier |
| `TBBCBF` | B2b | incomplet / axiome | 52 | 2 | oui | a-verifier |
| `TE1E1E` | B2b | incomplet / axiome | 67 | 3 | oui | a-verifier |
| `T63214` | B2b | contradictoire / wharf | 69 | 1 | oui | non-publiable |
| `TE3FC6` | B2b | contradictoire / wharf | 82 | 2 | oui | non-publiable |
| `T274E6` | B2b | contradictoire / aster | 69 | 0 | oui | non-publiable |
| `T2BD49` | B2b | contradictoire / aster | 72 | 3 | oui | non-publiable |
| `T2E30D` | B2b | contradictoire / axiome | 73 | 1 | oui | non-publiable |
| `T8C00C` | B2b | contradictoire / axiome | 65 | 0 | oui | non-publiable |

Fichiers exportés séparément : `scores-explo-B2b-evalues.json` (30), `conseil-explo-B2-evalue-complet.json` (12), `conseil-explo-B2b-evalue-complet.json` (12), `audit-explo-B2b-relecture.json` (24).
