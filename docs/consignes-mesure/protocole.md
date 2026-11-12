# Mesure du contrôle des consignes : protocole (avant les résultats)

Rédigé le 11 novembre 2026, **avant** la première exécution de `scripts/consignes-mesure.mjs`. Corpus et étiquettes (`corpus.csv`) commités avant l'exécution.

## Question
Quand une consigne contrôlable est écrite, `lib/consigneRules.js` en tire-t-il la bonne règle ? Et n'en tire-t-il jamais une que la consigne ne contient pas ?

## Ce qui est mesuré
Pour chaque consigne du corpus, `deriveConsigneRules` est appelé sur le texte seul. Les règles obtenues sont comparées au champ `attendu`, étiqueté **avant** l'exécution, par un seul étiqueteur (l'assistant, qui a aussi écrit le contrôle : limite à publier).

- **Règle reconnue** : `noEmoji`, `maxHashtags:N` (la valeur doit être exacte), `address:tu` ou `address:vous`.
- **Règle attendue mais non prise en charge** : `endsWithQuestion` (terminer par une question) et `terms` (un mot interdit dans un texte libre). Ces deux étiquettes servent à **chiffrer ce qui manque**, pas à juger le code actuel.
- **Rappel** : règles attendues retrouvées / règles attendues. **Fausses règles** : règles produites qui ne figurent pas dans `attendu`. Une consigne ambiguë ou conditionnelle a pour attendu « aucune règle ».

## Le corpus, et ce qu'il vaut
- **Réel** (R01 à R10) : les consignes qui existent dans le dépôt : profils de la démonstration, de E4 et d'évaluation, lignes éditoriales, et **les exemples que l'application elle-même propose aux utilisateurs** (placeholders et encadré « Mon mode d'écriture »). Aucune consigne d'un vrai compte n'est lisible depuis ce dépôt.
- **Synthétique** (S01 à S34) : formulations écrites par l'assistant, qui teste donc ses propres motifs sur ses propres phrases. Elles mesurent la couverture de formulations, **pas** ce que les utilisateurs écrivent.
- Résultat réel et résultat synthétique sont **rapportés séparément**.

## Règle contre l'auto-flatterie
Aucune modification de `consigneRules.js`, du corpus ou des étiquettes après la première exécution sans la consigner dans le journal avec les deux résultats. Les manques trouvés sont rapportés, pas corrigés dans la foulée.

## Limite principale
Ce qui compte, c'est ce que de vrais utilisateurs écrivent. Il faut un export de consignes de comptes de test ou de comptes consentants : voir `export-consignes.sql`.
