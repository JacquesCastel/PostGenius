# Mesure du contrôle des consignes : résultats

**Brouillon.** Protocole : `protocole.md` (rédigé avant l'exécution). Étiqueteur unique, qui est aussi l'auteur du contrôle.

## Consignes réelles du dépôt (R01 à R10)

- Consignes : 10
- Règles attendues retrouvées : 8 sur 8 (100.0 %)
- Dont règles du type pris en charge (émoji, hashtags, tutoiement/vouvoiement, question finale) : 8 sur 8 (100.0 %)
- Manquantes, type pris en charge : aucune
- Type non pris en charge (mot interdit en texte libre) : aucune
- **Fausses règles** (produites sans être attendues) : aucune
- Consignes sans règle attendue, et aucune règle produite : 6 sur 6 (100.0 %)

## Formulations synthétiques (S01 à S34)

- Consignes : 34
- Règles attendues retrouvées : 28 sur 31 (90.3 %)
- Dont règles du type pris en charge (émoji, hashtags, tutoiement/vouvoiement, question finale) : 28 sur 30 (93.3 %)
- Manquantes, type pris en charge : S03 noEmoji ; S12 address:tu
- Type non pris en charge (mot interdit en texte libre) : S18 terms
- **Fausses règles** (produites sans être attendues) : aucune
- Consignes sans règle attendue, et aucune règle produite : 8 sur 8 (100.0 %)

## Reproductibilité

```json
{
  "date": "2026-11-11T09:47:38.808Z",
  "consigneRules_sha256": "9af06db0657b459eb1d6421094bc92aebdc1d298312b9fbb937b7f65f906cbc6",
  "corpus_sha256": "974a841b8d51f6001af6277aae91b73695623329f4cc26ba29e32008375cc573",
  "script_sha256": "e3c5eb232d0863557505394032bf73f4ccc71686d1398554637a2d95c58ae3f2"
}
```

Détail : `detail.csv`. Relancer : `node scripts/consignes-mesure.mjs`.

## Limites
- Un seul étiqueteur, auteur du contrôle ; corpus réel minuscule (10 consignes, toutes du dépôt) ; formulations synthétiques écrites par le même auteur.
- Aucune consigne d'un vrai compte : voir `export-consignes.sql`.
- La « voix de la marque » (`brandVoice`) est lue par la route `/api/consignes` pour un post de page ; ce corpus ne la teste que sur le texte (R07), pas la lecture du champ.
