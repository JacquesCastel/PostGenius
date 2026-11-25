# Pilote automatique : éviter les doublons à la reprise

Correctif préparé le 24 novembre 2026 depuis `5e2cde1`. Ce lot concerne la création et la programmation des brouillons, sans modifier les règles d’apprentissage, la mesure, le design ni les réglages des comptes.

## Défaut corrigé

Le pilote créait d’abord un brouillon programmé, puis mettait la recommandation à « planifiée » et la reliait au brouillon. Si cette seconde opération échouait, le brouillon pouvait partir alors que la recommandation restait « proposée ». Une relance créait un autre brouillon.

Le stockage réunit maintenant le statut, le brouillon et le lien dans une transaction PostgreSQL `Serializable`. Un échec annule l’ensemble. Une recommandation déjà traitée ou liée ne produit plus de nouveau brouillon, même depuis une autre instance du pilote. L’opération est tentée au maximum trois fois en cas de conflit, avec le texte déjà généré : ces reprises n’appellent pas l’IA.

Le créneau définitif est choisi dans la transaction après la génération, parmi les vingt créneaux candidats. Tous sont vérifiés, y compris au-delà de l’ancien horizon de quatorze jours. Deux recommandations distinctes traitées simultanément ne réservent pas le même créneau.

L’opt-in, la suspension du compte, son rattachement éventuel à une agence, le seuil de confiance et l’état de la recommandation sont relus avant programmation. Le contrôle d’accès et le quota continuent d’être vérifiés avant l’appel IA, comme auparavant.

## Données historiques et limites

Un ancien brouillon automatique sans recommandation, au même thème tronqué et hors campagne/temps fort, bloque la nouvelle génération. Le thème seul ne prouve pas son origine : le correctif ne supprime rien et ne rattache aucun ancien brouillon automatiquement. Cette précaution peut bloquer un sujet légitime ; examiner le cas avant de le reprendre.

L’audit existant `scripts/audit-pilote-auto.sql` aide à repérer des anomalies, mais son rapprochement par thème reste un indice, pas une preuve de doublon. Examiner les anciens posts encore programmés avant toute réactivation. Aucun réglage de production n’est activé par ce lot.

Deux instances peuvent encore appeler l’IA avant que l’une gagne la programmation ; une seule peut enregistrer un brouillon pour la même recommandation. Le correctif ne déduplique pas sémantiquement deux recommandations différentes et ne garantit pas une publication LinkedIn « exactement une fois » après une panne dans le planificateur de publication. Ces questions sont distinctes de la programmation atomique.

## Vérifier dans une base locale jetable

Les tests d’orchestration et d’apprentissage restent exécutables sans base :

```sh
node --test scripts/autopilot-duplicates.test.mjs scripts/learning-frozen.test.mjs
```

Pour vérifier les transactions réelles : créer une base PostgreSQL **locale et jetable**, nommée exactement `linkeepost_autopilot_test`, y appliquer le schéma Prisma, puis fournir son URL dans `AUTOPILOT_TEST_DATABASE_URL` :

```sh
AUTOPILOT_TEST_DATABASE_URL='postgresql://…@127.0.0.1:PORT/linkeepost_autopilot_test' \
  node --test scripts/autopilot-store.postgres.test.mjs
```

Le test refuse les hôtes distants et les autres noms de base. Il ne lit ni `.env` ni `DATABASE_URL`. Les comptes et textes sont fictifs et supprimés dans cette base de test ; aucun appel à l’IA, à LinkedIn ou au service d’envoi d’e-mails n’est effectué.

La compilation et les autres contrôles de déploiement restent requis avant mise en production. L’audit de profondeur prévu dans deux à trois semaines reste le préalable à la décision sur le MVP d’apprentissage.
