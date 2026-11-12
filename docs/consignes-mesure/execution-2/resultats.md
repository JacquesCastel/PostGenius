# Mesure du contrôle des consignes : résultats

**Brouillon.** Protocole : `protocole.md` (rédigé avant l'exécution). Étiqueteur unique, qui est aussi l'auteur du contrôle.

## Consignes réelles du dépôt (R01 à R10)

- Consignes : 10
- Règles attendues retrouvées : 7 sur 8 (87.5 %)
- Dont règles du type pris en charge (émoji, hashtags, tutoiement/vouvoiement) : 7 sur 7 (100.0 %)
- Manquantes, type pris en charge : aucune
- Type non pris en charge (terminer par une question, mot interdit en texte libre) : R04 endsWithQuestion
- **Fausses règles** (produites sans être attendues) : aucune
- Consignes sans règle attendue, et aucune règle produite : 6 sur 6 (100.0 %)

## Formulations synthétiques (S01 à S34)

- Consignes : 34
- Règles attendues retrouvées : 25 sur 31 (80.6 %)
- Dont règles du type pris en charge (émoji, hashtags, tutoiement/vouvoiement) : 25 sur 29 (86.2 %)
- Manquantes, type pris en charge : S03 noEmoji ; S12 address:tu ; S16 maxHashtags:3 ; S29 maxHashtags:3
- Type non pris en charge (terminer par une question, mot interdit en texte libre) : S17 endsWithQuestion ; S18 terms
- **Fausses règles** (produites sans être attendues) : aucune
- Consignes sans règle attendue, et aucune règle produite : 8 sur 8 (100.0 %)

## Reproductibilité

```json
{
  "date": "2026-11-11T09:42:19.938Z",
  "consigneRules_sha256": "4d53321e849792d98413d5db951793a7d981ffc771bf03cbe92dcb93b32ecca4",
  "corpus_sha256": "974a841b8d51f6001af6277aae91b73695623329f4cc26ba29e32008375cc573",
  "script_sha256": "b40d7ed8d7507fe7fdb18119d983e030b2bc40c7456203def9038fc2e78abdfa"
}
```

Détail : `detail.csv`. Relancer : `node scripts/consignes-mesure.mjs`.

## Limites
- Un seul étiqueteur, auteur du contrôle ; corpus réel minuscule (10 consignes, toutes du dépôt) ; formulations synthétiques écrites par le même auteur.
- Aucune consigne d'un vrai compte : voir `export-consignes.sql`.
- Le contrôle ne lit que `styleNotes`, la ligne éditoriale, les remarques et les mots à éviter ; **pas** la « voix de la marque » (`brandVoice`) des posts de page.
