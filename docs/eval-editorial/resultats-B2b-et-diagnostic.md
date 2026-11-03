# Résultats de B2b et diagnostic architectural

Même méthode que pour B et B2 : 18 cas + 6 secondes générations sur les cas sensibles, 6 ancres, notation à l'aveugle par **un assistant IA unique** (pas une validation humaine), conseil évalué sur 12 cas B2 et 12 cas B2b. Les mesures ci-dessous sont recalculées par l'outil à partir des notes importées ; elles recoupent le rapport du relecteur.

## 1. Critères de B2b (18 cas, une génération)

| Critère | Cible | B2b | Verdict |
|---|---|---|---|
| Textes avec invention | ≤ 6/18 | **10/18** (A 13, B 10, B2 11) | échec |
| Rigueur moyenne | ≥ 3,4 | **2,78** (A 2,11, B 2,89, B2 2,72) | échec |
| Angle / fidélité / raisonnement ≥ A − 0,3 | 3,81 / 4,59 / 3,59 | 4,06 / 4,94 / 3,78 | atteint |
| AXIOME/transformation, raisonnement ≥ 4 | ≥ 4 | **5** (96/100, comme A) | atteint |
| Similarité entre profils | ≤ 0,13 | 0,117 | atteint |
| Contradictions `blocked`, incomplets ≥ `verify` | 3/3 | 3/3 et 3/3 (idem seconde génération) | atteint |
| Non sensibles hors `ready` | ≤ 4/12 | **9/12** | échec |
| Coût / durée | ≤ +25 % | **+79 % / +87 %** | échec |

B2b manque 5 critères. Règle fixée : **pas de B2c**, diagnostic architectural.

## 2. Mesures ajoutées
- **Inventions malgré `ready`** : 2 textes `ready` sur 3 contiennent une invention (B2 : 6 sur 9, B : 5 sur 8).
- **Audit** : détecte 6 inventions sur 15 (**40 %**, 30 % sur les 18 principaux) ; 2 faux positifs sur 9 textes sans invention. Au niveau du passage cité, environ la moitié seulement vise le vrai problème (4 passages pertinents sur 8 textes signalés) : l'audit signale des convictions (« la crédibilité se construit aussi en interne ») ou une simple reformulation du brief, et manque l'invention réelle.
- **Régressions** : B → B2b : 7 victoires, 10 défaites (angle −0,22). B2 → B2b : 10 victoires, 5 défaites. A → B2b : 9 victoires, 5 défaites, 4 égalités, rigueur +0,67. Aucune régression d'angle ou de raisonnement au-delà du seuil.
- **Échecs de génération** : 0 consigné (une génération a échoué avant l'ajout du suivi : JSON invalide).
- **Dérive du barème** : −2,5 points sur les nouvelles ancres, −3,3 sur les précédentes ; 2 changements de classification « bloquant » dans chaque séance, dans des sens opposés.
- **Conseil (12 cas)** : B2 détecter 2,0 / conseiller 1,50 / décider 0,50 ; B2b 2,0 / 1,75 / 0,50. « Décider » = 1 pour un blocage technique interne, jamais 2, car aucun avis n'est visible ni ne retient le texte.

## 3. Le constat décisif : le statut ne distingue pas un texte inventé d'un texte propre
Part des textes classés autre que `ready`, selon qu'ils contiennent une invention ou non (toutes générations) :

| | Avec invention | Sans invention |
|---|---:|---:|
| B | 50 % | 63 % |
| B2 | 57 % | 70 % |
| **B2b** | **87 %** | **89 %** |

Un statut utile classerait nettement plus souvent « non-ready » les textes inventés. Ici l'écart est nul ou inversé. Le « 87 % d'inventions repérées » de B2b ne prouve donc rien : il vient du fait que 21 textes sur 24 sont classés non-`ready`. Par type de brief :
- **Cas structurels** (contradictoires, incomplets, réglementaires) : le statut suit le **type de brief**, pas le texte. Les 6 contradictions sont toujours `blocked`, avec ou sans invention.
- **Cas ordinaires** (industrie, RH, transformation), là où l'invention est subtile : B marque 0 texte inventé sur 5 ; B2 0 sur 6 ; B2b 3 sur 5 contre 3 sur 4 pour les textes propres.

## 4. Pourquoi les prompts plafonnent
Trois niveaux de contrainte ont été essayés dans un seul appel : règle factuelle (B), rôle de l'auteur et classement préalable (B2), classement contraignant et audit après texte (B2b). Les inventions restent à 10-11 sur 18. Le plateau a une cause qui ressort des cas :
- Le **classement est lucide mais n'engage pas le texte** : `missing` nomme « la cause réelle de l'écart », puis le texte affirme « une question de périmètre ».
- L'**audit partage l'angle mort de l'auteur** : le modèle range « Pas une erreur, une question de périmètre » parmi ses *hypothèses plausibles* parce qu'il l'a écrit comme telle. Il juge son intention, pas ce qu'un lecteur comprend.
- Tout cela coûte +80 % de coût et +87 % de durée, sans discrimination mesurable.

## 5. Diagnostic architectural

**Ce qui fonctionne et reste à garder** : l'interprétation éditoriale (fidélité 4,9, angle 4,1, AXIOME/transformation retrouvé) et la détection des cas **structurels** : contradictions et briefs minces sont identifiés à 12 sur 12.

**Ce qui ne fonctionne pas** : détecter, dans le texte, ce que l'auteur a ajouté, quand le même modèle l'écrit et le juge dans le même appel.

**Conclusion : il faut deux mécanismes distincts, parce que les deux problèmes sont de nature différente.**

1. **Une décision éditoriale avant la rédaction, sur le brief seul** : le brief est-il contradictoire ou trop mince pour fonder un post ? Cette décision est déjà bien faite (12 sur 12) et n'a pas besoin du texte. Placée en amont, elle peut empêcher de rédiger un post qui concilie des chiffres inventés, ce qu'aucune version ne sait éviter après coup. C'est de la décision éditoriale, pas de la vérification. Coût : un petit appel sans rédaction.
2. **Une vérification du texte par un appel indépendant** : un second appel qui ne voit que (brief, profil, sources, texte), qui n'a pas écrit le texte et qui liste chaque affirmation factuelle sur le cas avec son statut (étayée / non étayée). Il n'a pas l'intention de l'auteur à défendre. C'est la seule architecture qui sépare réellement rédaction et vérification. Elle n'est pas prouvée : il faut d'abord mesurer si un vérificateur indépendant fait mieux que l'auto-audit (40 % de rappel).

**Étape suivante proposée, sans toucher au moteur** : un banc d'essai hors ligne du vérificateur. On le fait tourner sur les textes déjà générés et déjà étiquetés par les lecteurs (environ 130 textes de A, B, B2, B2b, D et D+, soit ~1,5 à 2 $), en comparant deux modèles (Sonnet et Haiku). Critères : rappel d'au moins 80 %, faux positifs d'au plus 20 % au niveau du texte, et précision du passage cité vérifiée à la main sur un échantillon. Si le banc d'essai échoue, la conclusion est que la vérification automatique ne suffit pas et que le produit doit amener l'auteur à confirmer lui-même les affirmations signalées (changement d'interface, à décider plus tard). Si le banc d'essai réussit, on assemblera A (ou une règle factuelle légère) + vérificateur + décision en amont, et on mesurera l'ensemble.

## 6. Limites
Un seul évaluateur (assistant IA), barème dérivant de 2,5 à 3,3 points, une génération par cas, 18 cas, étiquettes d'invention dont 4 contestées entre lecteurs. Le banc d'essai du vérificateur doit utiliser des étiquettes de consensus et inclure une relecture humaine de l'échantillon décisif avant toute décision d'architecture.
