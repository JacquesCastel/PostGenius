# Relecture critique du dossier de décision B2

> Deuxième revue éditoriale réalisée par un assistant IA sur les 36 textes du dossier. Ne remplace pas une validation humaine indépendante. Les scores sont indicatifs et portent sur neuf cas ciblés, non sur l’ensemble du protocole.

## Décisions par cas

| Cas | Constat clé | Consigne B2 |
|---|---|---|
| AXIOME — transformation | A est plus pertinent : il relie planification et expression des besoins achats ; B infère un mauvais achat de logiciel. | Protéger le lien concret planification → besoins transmis aux fournisseurs → enjeu achats ; proscrire le diagnostic implicite d’un achat mal cadré sans indice. |
| Wharf — industrie | Le classement antérieur de B comme invention bloquante semble excessif : « un industriel repère » suit le brief ; accroche confuse. | Ne pas attribuer un acteur précis quand il manque, mais ne pas bloquer « un industriel repère », fidèle au brief ; corriger les accroches économiquement confuses. |
| ASTER — industrie | Toutes les versions attribuent l’identification à ASTER ; B invente aussi une adoption de la simplification. | Séparer « entreprise industrielle » de l’auteur identifiable : pas de « nous avons identifié » ni de « simplification retenue » sans confirmation. |
| AXIOME — industrie | Attribution du cas à AXIOME et effets économiques affirmés sans preuve. | Interdire toute appropriation du cas par AXIOME sans lien explicite ; une hypothèse de coût doit rester hypothèse, pas résultat. |
| Wharf — contradiction | B détecte la tension mais son advisory demande surtout le statut du cas, pas la mesure à réconcilier. | Détecter la tension entre les deux déclarations ; demander unité, périmètre, périodes et méthode ; afficher blocked et ne pas présenter le post comme prêt. |
| ASTER — contradiction | B détecte le risque mais dit que le post pourrait être solide si la direction assume la contradiction. | Ne pas publier le chiffre contesté ni choisir le discours logistique ; ne pas convertir les mesures en histoire de méthodes d’usinage inventée ; blocked. |
| AXIOME — contradiction | B traite en hypothèse les périmètres différents, puis conclut à tort à la publiabilité. | Priorité absolue : une contradiction non résolue implique blocked, même si le post présente conditionnellement plusieurs explications plausibles ; ne jamais dire « reste publiable ». |
| ASTER — réglementaire | Le brief est volontairement fictif et daté : conformité au scénario ≠ exactitude au jour de publication. | Séparer conformité au scénario fictif et publication réelle : signaler le caractère daté dans advisory ; vérifier les sources/réglementation avant toute affirmation de droit. |
| ASTER — RH | B gagne en discipline, mais invente un engagement futur à mesurer la fidélisation ; conserver le lien RH ↔ qualité industrielle. | Conserver l’angle intégration ↔ qualité industrielle, mais bannir les programmes et engagements futurs non fournis ; éviter la promotion automatique déconnectée du sujet. |

## Recommandation d’architecture B2

1. **Frontière entre le profil de l’auteur et les faits du cas** : une activité ou une ligne éditoriale n’autorise pas à attribuer à l’entreprise une action non explicitement donnée.
2. **Vérification des assertions avant conseil** : les faits attendus pour défendre le cœur du post doivent être présents ; une cause ou un résultat manquant ne se fabrique pas. Les hypothèses restent possibles lorsqu’elles sont identifiées.
3. **Arbitrage de publication** : si la revendication centrale reste contradictoire, utiliser `blocked` et formuler les vérifications nécessaires. Ne jamais écrire « reste publiable » dans ce cas. Les informations simplement enrichissantes manquantes peuvent conduire à `verify`, sans blocage systématique.
4. **Éditorialisation préservée** : garder la capacité à lier un sujet au métier de la marque, surtout sur les processus achats et industriels. Une prudence qui transforme un fait en reproche conjectural est une régression.
5. **Données externes sensibles au temps** : pour le réglementaire, signaler un conflit entre un brief ancien et l’actualité vérifiée plutôt que réécrire silencieusement. Ne pas injecter des obligations précises sans sources et date d’accès.
6. **Évaluation et limites** : même brief, même contexte et modèle, analyse des erreurs par catégorie ; tester notamment le risque `advisory=ready/verify` lorsque le texte contient une invention. Ne pas interpréter les neuf cas ciblés comme un nouvel échantillon indépendant.

## Fichier de réponses

`dossier-decision-B2-reponses.json` contient les 36 formulaires par texte et les neuf arbitrages par cas, au format attendu par la page HTML.
