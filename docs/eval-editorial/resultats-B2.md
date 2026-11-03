# Résultats de B2 sur le jeu exploratoire

18 cas (une génération) + 6 générations supplémentaires sur les cas sensibles, notés par un assistant IA unique, en aveugle, avec 6 textes d'ancrage (A et B déjà notés). La seconde lecture sur les neuf cas ciblés n'a pas été faite pour B2, et 9 des 12 évaluations de conseil manquent (la feuille `conseil-explo-B2.md` n'a pas été renseignée). **Les conclusions ci-dessous sont donc provisoires.**

## 1. Fiabilité du barème : dérive entre séances
Sur les 6 ancres renotées : écart moyen **−3,3 points /100** (la séance B2 est plus sévère), écart absolu moyen 3,7, **2 changements de classification « bloquant »** (un dans chaque sens). Corriger les moyennes de B2 de +3,3 est une estimation grossière (6 points) ; je présente les deux valeurs et je ne tranche pas sur de petits écarts.

## 2. Critères fixés pour B2

| Critère | Cible | Résultat B2 | Verdict |
|---|---|---|---|
| Textes avec invention (une lecture ; n=1) | ≤ 6 / 18 | **11 / 18** (A 13, B 10) | **échec** |
| Rigueur moyenne /5 | ≥ 3,4 | **2,72** (A 2,11, B 2,89) | **échec** |
| Angle, fidélité, raisonnement ≥ A − 0,3 | 3,81 / 4,59 / 3,59 | 4,00 / 4,94 / 3,67 | ✔ |
| AXIOME/transformation, raisonnement ≥ 4 | ≥ 4 | **5** (94/100 ; A 96, B 86) | ✔ |
| Similarité entre profils | ≤ 0,13 | 0,121 | ✔ |
| Contradictions classées `blocked` | 3/3 | 3/3 (6/6 avec les secondes générations) | ✔ |
| Incomplets au moins `verify` | 3/3 | 3/3 (6/6) | ✔ |
| Recommandations rassurantes si état ≠ ready | 0 | 0 conservée, **4/24 remplacées par le code** | ✔ (grâce au garde) |
| Non sensibles hors `ready` | ≤ 4/12 | 3/12 (tous réglementaires, voulu) | ✔ |
| Coût par texte | ≤ +25 % | 0,0226 $ contre 0,0122 $ : **+85 %** | **échec** |
| Durée | ≤ +25 % | 21,3 s contre 12,6 s : **+69 %** | **échec** |

B2 atteint 7 critères sur 11 et en manque 4. La règle d'arrêt s'applique : **une seule itération de plus est permise**.

## 3. B2 contre A et B (appariés)
- Score /100 : A 77,2 ; B 80,9 ; B2 78,4 (≈ 81,7 en ajoutant la dérive estimée). B2 ≈ B, dans le bruit.
- B2 contre A : 10 victoires, 6 défaites, 2 égalités. B2 contre B : 8 victoires, 9 défaites, 1 égalité.
- Gains nets de B2 : contradictoire Wharf (+17 sur A), industrie ASTER (+8), contradictoire ASTER (+16), transformation AXIOME (+8 sur B ; **le lien planification → besoins fournisseurs est retrouvé**).
- Régressions de B2 : contradictoire AXIOME (B 85 → 65 : « les deux ont raison », rigueur 4 → 0) ; RH ASTER (rigueur 4 → 2 : objectif de la journée et « pièces dans les délais » inventés) ; incomplet ASTER (rigueur 3 → 2) ; réglementaire ASTER (angle 4 → 3).

## 4. Conseil
Trois cas évalués seulement (contradictions n=1) : détecter 2, conseiller 1,33, décider 1. Le blocage existe dans les données (`blocked`) mais pas dans le parcours utilisateur : l'alerte est invisible et le texte est tout de même généré, et deux textes sur trois inventent encore une explication. Les 9 autres cas ne sont pas notés.

## 5. Pourquoi les inventions survivent au classement
Sur les 14 textes B2 jugés bloquants, le classement interne était **lucide** : la liste `missing` nomme presque toujours l'élément manquant (par exemple « la cause réelle de l'écart (indicateurs différents, périmètres distincts…) »). Le texte l'affirme ensuite quand même (« ils mesurent des périmètres différents »). Le classement est écrit **avant** le texte et n'engage pas le texte.

Autre constat, plus grave pour la sécurité : le statut `advisory` ne mesure pas la qualité du texte écrit.

| Statut B2 | avec invention | sans |
|---|---:|---:|
| ready | **6** | 3 |
| verify | 4 | 5 |
| blocked | 4 | 2 |

Sur 9 textes `ready`, 6 contiennent une invention. B avait le même défaut (5 sur 8). Le statut détecte bien ce qui est visible dans le brief (contradiction, brief mince), pas ce que le texte ajoute.

## 6. D'où vient le surcoût
Consignes de fond : 571 caractères pour A, 4 129 pour B2 (frontière 2 779 + classement 687 + advisory 663), soit environ +1 200 tokens en entrée. Sortie : classement ≈ 745 caractères, advisory ≈ 442, soit environ +460 tokens par rapport à A.
