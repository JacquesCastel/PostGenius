# Synthèse du jeu exploratoire (36 textes) et priorités pour la version B

Moteur A (LinkeePost actuel) contre D (Claude utilisé directement), même modèle, mêmes briefs, mêmes profils. 6 briefs × 3 marques × 1 génération par version. Les notes ont été saisies à l'aveugle par **un seul évaluateur, qui est un assistant IA et non une personne**, puis les versions ont été révélées. Ce n'est pas une mesure statistique.

## 1. Résultats

| | A (LinkeePost) | D (Claude direct) |
|---|---:|---:|
| Score éditorial moyen /100 | **77,2** | 73,2 |
| Angle | 4,11 | 3,94 |
| Fidélité à la marque et à la cible | **4,89** | 4,56 |
| Raisonnement | 3,89 | **4,00** |
| Rigueur factuelle | **2,11** | 1,61 |
| Rédaction | 4,11 | 4,11 |
| Textes avec invention bloquante | 13 / 18 | 15 / 18 |
| Jugés publiables sans correction | 4 | 0 |
| À vérifier / non publiables | 11 / 3 | 15 / 3 |
| Score moyen des textes non bloquants | 84,6 (5 textes) | 74,3 (3 textes) |

Comparaisons par brief et par marque : A gagne 10, D gagne 7, 1 égalité. Un test des signes sur 17 comparaisons sans égalité donne p ≈ 0,63 : **l'écart n'est pas significatif**. Les écarts moyens par type de brief sont plus parlants que le décompte :

| Brief | A | D |
|---|---:|---:|
| transformation | **86,0** | 72,0 |
| RH | **81,0** | 68,3 |
| réglementaire (fictif) | **80,0** | 77,0 |
| incomplet | 70,7 | 70,0 |
| contradictoire | 71,3 | **73,7** |
| industrie | 74,3 | **78,0** |

## 2. Forces et faiblesses

**A (LinkeePost)**
- Force : l'interprétation au service de la marque. Fidélité 4,89, avance nette sur transformation et RH (AXIOME sur la transformation : 96 contre 62, le sujet est relié aux achats). Les contextes de profil, de cible et de ligne éditoriale produisent une vraie prise de parole.
- Force : les textes sont prêts à lire (pas d'enveloppe), et ce sont les seuls jugés publiables (4).
- Faiblesse : 13 textes sur 18 contiennent une invention bloquante. La rigueur (2,11) est le point le plus bas.
- Faiblesse : le raisonnement (3,89) est un peu en dessous de D.
- Faiblesse : sur l'industrie et le contradictoire, A n'est pas meilleur que D.

**D (Claude direct)**
- Force : raisonnement un peu plus riche, parfois plus fort sur l'industrie. Ce n'est pas un témoin faible.
- Faiblesse : moins de fidélité à la marque, rigueur plus basse (1,61), aucun texte publiable. Il ajoute enveloppe et commentaires.
- Particularité : il glisse parfois un avis utile hors du post (voir §3).

**Commun** : des raisonnements solides reposent sur des faits inventés. Inventions les plus fréquentes : un acteur qui repère le problème, l'origine d'une tolérance, un programme ou des réactions de participants, des durées, des résultats obtenus, des citations, des obligations réglementaires précises.

## 3. Capacité de conseil (12 cas : briefs incomplets et contradictoires)

Échelle 0 à 2 sur détecter, conseiller, décider.

| | A (6 cas) | D (6 cas) |
|---|---:|---:|
| Détecter | 0,33 | 0,50 |
| Conseiller | 0,00 | 0,50 |
| **Décider** | **0,00** | **0,00** |

**Aucune des 12 réponses ne bloque ou ne déconseille la publication d'un texte reposant sur des faits non établis.**

Accessibilité de l'avertissement, vérifiée dans le code et les réponses brutes :
- **A** : les deux réponses créditées d'une détection (`explo-contradictoire`, ASTER et AXIOME) évoquent le paradoxe dans le champ `why`. Ce champ s'affiche dans le panneau « Pourquoi ce post ? » de l'application, **fermé par défaut**, et il décrit le choix d'accroche, pas une alerte. Dans ces deux textes, le paradoxe est exploité comme matière éditoriale (puis « résolu » par une histoire inventée) : je ramènerais ces deux « détecter 1 » à 0. Pour l'utilisateur, aucun avertissement exploitable n'existe aujourd'hui.
- **D** : les remarques (« j'ai écarté le −20 % car il contredit le directeur logistique » ; « si vous avez le nom du prix, je peux affiner ») sont visibles dans une conversation Claude normale, mais elles n'existent pas dans LinkeePost : le contrat de réponse n'a pas de champ de conseil.
- Distinction demandée : un texte dangereusement affirmatif accompagné d'une note (D, `T4E635`) n'obtient jamais la même évaluation qu'un refus de publier. Il obtient « décider 0 », alors qu'un refus ou un « à ne pas publier en l'état » clair obtiendrait 2.

## 4. Vérification du nettoyage de D
Les deux textes sous 85 % (T4E635 : 74 %, T5124A : 80 %) ont été relus à la main : seuls ont été retirés l'introduction, une note ou un conseil final et la mise en forme. Aucun passage du post n'a disparu. Une nuance : l'introduction de T4E635 (« …basé sur l'information fiable uniquement ») porte elle-même un signal de tri, à lire comme un avis de D.

## 5. Priorités pour la version B

Classées par impact éditorial attendu, risque de régression et coût. Aucune ne touche aux blocs de profil, de cible, de ligne éditoriale, de mémoire ni de sources, qui fondent la force de A.

1. **Frontière factuelle explicite** (fort impact, coût nul). Remplacer le garde-fou actuel (chiffres, noms, statistiques) par une règle plus large : le brief est la seule source de faits ; ne jamais ajouter d'acteur, de durée, de cause, de résultat, de décision, de date, de citation, de contenu de programme ni d'exemple présenté comme réel. Dire ce que le modèle peut faire : raisonner, poser une conviction, formuler une hypothèse au conditionnel.
2. **Supprimer la pression à inventer** (fort impact, faible risque). La consigne « une preuve, un exemple concret » et la tolérance des « cas types » incitent à fabriquer des faits. Les remplacer par « un raisonnement, un principe, un cas hypothétique annoncé comme tel ».
3. **Garder le ton engagé** (condition de réussite). Les meilleurs textes (TD63EE 96/100, T5FCCC) montrent qu'on peut garder une position forte en restant au conditionnel. B doit viser cette forme, pas des textes prudents.
4. **Traiter les briefs contradictoires et incomplets** (impact élevé, mais touche au contrat). B peut au minimum interdire de concilier ou de trancher et de fabriquer des faits pour combler. Dire « ne publiez pas en l'état » exige un canal visible. **Décision à prendre avec toi avant de coder** : voir §6.
5. **Mesure** : refaire exactement la même mesure sur le jeu exploratoire ; ajouter une variante de contrôle D+ (Claude direct avec la même règle factuelle) pour savoir si le gain vient de la règle ou de l'orchestration ; ajouter au moins une seconde génération par cas ; idéalement un second évaluateur humain.

Critères de réussite proposés pour B sur le jeu exploratoire : invention bloquante de 13 à 3 textes ou moins sur 18 ; angle, fidélité et raisonnement chacun à moins de 0,3 point de A ; similarité entre profils non supérieure à A ; coût et durée inchangés à ±10 %.

C n'est lancée que si B laisse un écart éditorial reproductible.

## 6. Question de contrat à trancher avant de coder le conseil
Pour exprimer « manque d'informations » ou « informations contradictoires, à clarifier », trois options :
- **a)** Aucun changement de contrat ni d'interface : B se contente de ne rien inventer et de ne pas concilier les contradictions. Sûr, mais le conseil reste muet.
- **b)** Champ optionnel `advisory` ajouté à la réponse (`text`, `extra`, `sources`, `why` inchangés, compatible avec l'existant), non affiché tant que l'interface n'est pas modifiée. Permet de mesurer la détection sans changer l'écran.
- **c)** b) plus un bandeau visible dans l'application. Seule option qui donne un avertissement accessible à l'utilisateur, mais elle modifie l'interface.

Ma recommandation : **b) pour B**, puis c) seulement si la mesure montre que la détection fonctionne.
