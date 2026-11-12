# Mesure de « Chiffres à vérifier » sur E4 : résultats

**Brouillon non publié, à relire.** Protocole : `protocole-mesure.md` (rédigé avant l'exécution). Un seul classeur, 70 textes, 10 sujets fictifs : voir les limites en bas.

| Mesure | A | B | C | D | AN | BN | CN | TOUT |
|---|---|---|---|---|---|---|---|---|
| Textes | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 63 |
| Chiffres I+X : signalés | 38 sur 47 (80.9 %) | 17 sur 26 (65.4 %) | 0 sur 0 | 15 sur 18 (83.3 %) | 1 sur 1 (100.0 %) | 0 sur 0 | 0 sur 0 | 71 sur 92 (77.2 %) |
| Chiffres D : signalés | 1 sur 1 (100.0 %) | 0 sur 0 | 0 sur 0 | 0 sur 0 | 0 sur 0 | 0 sur 0 | 0 sur 0 | 1 sur 1 (100.0 %) |
| Chiffres F signalés à tort | 0 sur 0 | 3 sur 14 (21.4 %) | 0 sur 11 (0.0 %) | 2 sur 12 (16.7 %) | 0 sur 0 | 0 sur 11 (0.0 %) | 0 sur 11 (0.0 %) | 5 sur 59 (8.5 %) |
| Chiffres V (absents, vérifiés) signalés | 2 sur 2 (100.0 %) | 0 sur 0 | 0 sur 0 | 1 sur 1 (100.0 %) | 0 sur 0 | 0 sur 0 | 0 sur 0 | 3 sur 3 (100.0 %) |
| Textes avec un problème chiffré : alerte affichée | 9 sur 9 (100.0 %) | 7 sur 7 (100.0 %) | 0 sur 0 | 7 sur 7 (100.0 %) | 1 sur 1 (100.0 %) | 0 sur 0 | 0 sur 0 | 24 sur 24 (100.0 %) |
| Textes sans aucun problème : alerte affichée | 0 sur 0 | 1 sur 2 (50.0 %) | 0 sur 8 (0.0 %) | 0 sur 1 (0.0 %) | 0 sur 8 (0.0 %) | 0 sur 8 (0.0 %) | 0 sur 8 (0.0 %) | 1 sur 35 (2.9 %) |
| Problèmes invisibles (sans chiffre) I / X / D | 4 / 0 / 0 | 0 / 0 / 0 | 2 / 0 / 0 | 3 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 1 | 0 / 0 / 1 | 9 / 0 / 2 |
| Non signalés I+X : coïncide / ignoré / autre | 2 / 7 / 0 | 0 / 9 / 0 | 0 / 0 / 0 | 0 / 3 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 2 / 19 / 0 |
| Non signalés D : coïncide / ignoré / autre | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Textes avec plus de 6 signalements | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| Citations non localisées | 5 | 0 | 0 | 6 | 1 | 0 | 0 | 12 |

## Reproductibilité

```json
{
  "date": "2026-11-11T09:05:37.790Z",
  "figureCheck_sha256": "0558e89c16b1ae6cf9d6a01013283e2c5d5e29602d12d12eae9c3c6a997e221a",
  "script_sha256": "694deca02bff5635d69c6c3cac4de999d26f07003d476516bdb1bc6f6b9fc221",
  "grille_elements_sha256": "c069d7fbfe346c66121c262c682c48b8fdda2d186663b2462a45aede4c748848",
  "textes_sha256": "081c81bd90952830eb6ff638c790be4771eadfa7950ab92bc657a7827aad82b2"
}
```

Lancer : `node scripts/e4-mesure-figurecheck.mjs`. Détail élément par élément : `detail-elements.csv`.

## Limites
- Un seul classeur, qui connaît le dispositif : aucun désaccord mesuré.
- Entités et chiffres fictifs, 10 sujets, une génération par cas : pas de généralisation.
- Les sujets S03, S05 et S10 n'ont aucun chiffre dans la fiche : tout nombre y est suspect par construction.
- La condition A ne reçoit pas la fiche : pour elle, le contrôle est évalué contre la fiche que l'auteur aurait eue.
- Le contrôle est indicatif et ne voit ni les noms, ni les durées en lettres, ni les citations (ligne « invisibles »).
