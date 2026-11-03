# Périmètre proposé pour B2

B2 = B + cinq changements ciblés, chacun relié à une observation du jeu exploratoire, réversible et mesurable. Pas de nouvelle architecture, pas d'appel supplémentaire, pas de changement d'interface. **Rien n'est codé** : ce document attend ta validation personnelle.

## 0. Ce que la relecture du dossier établit, et ses limites

- Les 36 réponses et les 9 arbitrages sont complets et cohérents. Les 12 cas de contradiction ont leurs trois champs (détection, interprétation, décision).
- La seconde lecture (un assistant IA, pas une personne indépendante) est d'accord avec la première sur **32 textes sur 36** pour « bloquant / invention » et pour la recommandation de publication ; écart moyen sur l'angle 0,14 et sur la fidélité 0,17. Les deux lectures sont donc cohérentes, mais **elles ne sont pas indépendantes** (même famille de modèles).
- Les 4 désaccords : Wharf/industrie B n'est plus une invention (« un industriel repère » suit le brief) ; trois textes jugés non bloquants au premier passage sont des inventions au second (ASTER/contradiction D+, ASTER/RH B et D+ : engagements ou intentions non fournis).
- **Conséquence importante** : sur ces 9 cas, les inventions sont A 8 sur 9, B 6, D 9, D+ 7. **D+ ne fait plus mieux que B.** L'avantage de D+ constaté au premier passage (7 contre 10 textes bloquants sur 18) est dans la marge de désaccord entre lecteurs. Je ne retiens donc plus « D+ bat B sur la rigueur » ; je retiens seulement « la règle seule aide beaucoup Claude direct, et B fait au moins aussi bien dès qu'on la lit sévèrement ».
- Arbitrages retenus (6 confirmés, 1 trop sévère, 2 trop indulgents) : la première évaluation était trop indulgente sur le réglementaire et le RH d'ASTER.
- Les décisions ci-dessous viennent d'une relecture IA : **tu dois les valider personnellement avant que je code** (section 6).

## 1. Les cinq changements

**R1. Le profil n'est pas un fait du cas.** Une activité ou une ligne éditoriale ne permet pas de prêter à l'auteur une action du brief. Écrire « nous avons… », « on a… » ou nommer l'auteur comme acteur seulement si la demande dit que l'auteur a agi ; sinon troisième personne (« une entreprise industrielle », « les deux équipes ») ou propos général. Une pratique habituelle du profil reste possible comme principe, pas comme épisode.
*Observé :* industrie ASTER (A, B, D, D+), industrie AXIOME (B, D, D+), contradiction ASTER B (« on l'a pris comme un signal »), contradiction Wharf B et D+ (« un problème que nous rencontrons souvent »).

**R2. Interdits ajoutés à la frontière factuelle.** Aucun engagement futur non fourni (« nous mesurerons dans les mois qui viennent »), aucune ancienneté ni caractère inédit (« première », « depuis longtemps », « personne ne s'est jamais demandé »), aucune réaction de personnes (« les participants ont apprécié »), aucun reproche conjectural : une cause hypothétique reste un mécanisme général au conditionnel, jamais une faute prêtée à l'entreprise.
*Observé :* RH ASTER (A, B, D, D+), industrie Wharf D+, AXIOME B et D+, transformation AXIOME B (« c'est souvent le signe qu'on a acheté une solution avant d'avoir défini le problème »).

**R3. Classement court dans le même appel.** Avant le texte, le modèle remplit des champs internes courts : `facts` (≤ 5), `missing` (≤ 4), `contradictions` (≤ 2). Ils ne sont **pas renvoyés** au client (contrat inchangé) ; ils sont consultables seulement avec `EDITORIAL_DEBUG=1`, pour la mesure. C'est la forme minimale de l'étape explicite que D+ montre à l'écran.

**R4. `advisory` piloté par ce classement.** Calculé en code à partir de R3 :
- au moins une contradiction → `blocked` (forcé) ;
- un fait central manquant → au moins `verify` ;
- `ready` seulement si ni l'un ni l'autre.
La recommandation nomme les vérifications précises (unité, périmètre, période, méthode) et ne dit jamais « reste publiable », « solide » ou « prêt » quand l'état n'est pas `ready`. Un compteur de recommandations rassurantes sert de métrique.
*Observé :* AXIOME contradiction B (« reste publiable »), ASTER contradiction B (« si oui, le post est solide »), Wharf contradiction B (question sur le statut du cas, pas sur l'indicateur).

**R5. Sujets sensibles au temps (réglementaire, juridique, normes).** Ne nommer aucun texte, article, date, seuil ni obligation absents du brief ; `advisory` au moins `verify`, avec la consigne de vérifier le statut et la date actuels de la source. Cela **restreint** la clause « connaissances générales solides » que tu avais ouverte. Le moteur ne peut pas vérifier l'actualité : il ne peut que le demander.
*Observé :* réglementaire ASTER (A et B nomment le règlement et énumèrent des obligations ; le brief est périmé : le règlement s'applique depuis le 12 août 2026).

Protection, pas une règle de plus : le garde-fou existant « position claire et engagée » reste, avec une phrase positive : relier le fait au métier de la marque sous forme de raisonnement (ex. planification → besoins transmis aux fournisseurs → enjeu achats, cas AXIOME/transformation).

## 2. Hors périmètre
Interface et affichage de `advisory` ; blocage effectif de la publication ; recherche web ou vérification d'actualité ; séries, variantes et retouches ; étape « angle » de la version C ; second appel au modèle ; modification des profils, de la mémoire et des sources.

**Honnêteté sur la protection** : tant que `advisory` n'est ni affiché ni pris en compte dans le parcours de publication, B2 améliore la mesure de la détection, pas la sécurité de l'utilisateur.

## 3. Mesure de B2
Même protocole, mêmes briefs, mêmes profils, mêmes paramètres.

**Étape 1, jeu exploratoire** : 18 textes B2 (+ une seconde génération sur les 6 cas sensibles pour limiter le bruit). Deux lectures indépendantes en aveugle ; un texte est « invention » seulement si les deux lectures concordent ; les désaccords vont à ta relecture.

**Critères de réussite (tous requis)**

| Critère | A | B | Cible B2 |
|---|---:|---:|---:|
| Textes avec invention (lectures concordantes) | 13/18 | 10/18 | **≤ 6/18** |
| Rigueur moyenne /5 | 2,11 | 2,89 | **≥ 3,4** |
| Angle, fidélité, raisonnement | 4,11 / 4,89 / 3,89 | 4,28 / 4,89 / 3,83 | **chacun ≥ A − 0,3** ; AXIOME/transformation raisonnement ≥ 4 |
| Similarité entre profils | 0,119 | 0,126 | **≤ 0,13** |
| Contradictions classées `blocked` | 0/6 | 0/6 | **6/6** |
| Briefs incomplets au moins `verify` | — | 6/6 | **6/6** |
| Recommandations rassurantes si état ≠ ready | — | ≥ 2 | **0** |
| Cas non sensibles passés en non-`ready` | — | 4/12 | **≤ 4/12** (pas de prudence systématique) |
| Coût / durée par texte | 0,0122 $ / 12,6 s | +36 % / +29 % | **≤ +25 % / ≤ +25 %** |

**Étape 2, jeu de validation** (9 briefs × 3 profils × 2 générations), lancé **une seule fois**, seulement si l'étape 1 réussit. Jamais utilisé pour régler.

**Règle d'arrêt** : si B2 manque deux critères ou plus, une seule itération de plus est permise ; ensuite on réexamine l'étape « angle » (C) au lieu d'empiler des règles.

## 4. Cas de contrôle de non-régression
AXIOME/transformation (A 96/100) ; RH × 3 ; contradictoire Wharf/ASTER/AXIOME ; réglementaire ASTER. Ils servent de garde-fous : B2 ne doit pas reperdre le lien planification → besoins fournisseurs ni redevenir générique.

## 5. Réversibilité
B2 s'active par `EDITORIAL_ENGINE=B2`. Sans variable, moteur A inchangé (empreintes vérifiées par test). Les tests de non-régression existants (15) restent ; on ajoute des tests de cohérence entre classement et statut `advisory`.

## 6. À valider par toi, personnellement, avant tout code
1. **R5** : accepter de restreindre les connaissances générales (pas de nom de texte ni d'obligation sans le brief) pour les sujets réglementaires et juridiques.
2. **R4** : accepter qu'une contradiction détectée par le modèle force `blocked` même si le post la traite avec prudence, avec le risque de faux blocages.
3. **R1** : accepter que les récits à la première personne (« nous avons identifié… ») disparaissent quand le brief ne dit pas que l'auteur a agi. Alternative moins stricte : les autoriser mais passer `advisory` en `verify`.
4. **R3** : accepter des champs internes non renvoyés, visibles seulement en mode debug.
5. Relire personnellement les 4 textes contestés entre les deux lectures : T42D98, T8F877, TD1417, TB3342.
