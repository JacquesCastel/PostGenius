# Mesure de « Chiffres à vérifier » sur E4 : résultats

**Brouillon non publié, à relire.** Protocole : `protocole-mesure.md` (rédigé avant l'exécution). Un seul classeur, 70 textes, 10 sujets fictifs : voir les limites en bas.

| Mesure | A | B | C | D | AN | BN | CN | TOUT |
|---|---|---|---|---|---|---|---|---|
| Textes | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 70 |
| Chiffres I+X : signalés | 45 sur 59 (76.3 %) | 16 sur 28 (57.1 %) | 0 sur 1 (0.0 %) | 15 sur 21 (71.4 %) | 1 sur 1 (100.0 %) | 0 sur 2 (0.0 %) | 0 sur 0 | 77 sur 112 (68.8 %) |
| Chiffres D : signalés | 2 sur 2 (100.0 %) | 0 sur 0 | 0 sur 0 | 0 sur 0 | 0 sur 0 | 0 sur 0 | 0 sur 0 | 2 sur 2 (100.0 %) |
| Chiffres F signalés à tort | 0 sur 0 | 3 sur 17 (17.6 %) | 1 sur 14 (7.1 %) | 2 sur 15 (13.3 %) | 0 sur 0 | 0 sur 14 (0.0 %) | 1 sur 13 (7.7 %) | 7 sur 73 (9.6 %) |
| Chiffres V (absents, vérifiés) signalés | 2 sur 2 (100.0 %) | 0 sur 0 | 0 sur 0 | 1 sur 1 (100.0 %) | 0 sur 0 | 0 sur 0 | 0 sur 0 | 3 sur 3 (100.0 %) |
| Textes avec un problème chiffré : alerte affichée | 10 sur 10 (100.0 %) | 7 sur 8 (87.5 %) | 1 sur 1 (100.0 %) | 8 sur 8 (100.0 %) | 1 sur 1 (100.0 %) | 0 sur 1 (0.0 %) | 0 sur 0 | 27 sur 29 (93.1 %) |
| Textes sans aucun problème : alerte affichée | 0 sur 0 | 1 sur 2 (50.0 %) | 0 sur 8 (0.0 %) | 0 sur 1 (0.0 %) | 0 sur 9 (0.0 %) | 0 sur 8 (0.0 %) | 0 sur 8 (0.0 %) | 1 sur 36 (2.8 %) |
| Problèmes invisibles (sans chiffre) I / X / D | 4 / 0 / 0 | 0 / 0 / 0 | 2 / 0 / 0 | 3 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 1 | 0 / 0 / 2 | 9 / 0 / 3 |
| Non signalés I+X : coïncide / ignoré / autre | 9 / 5 / 0 | 7 / 5 / 0 | 0 / 1 / 0 | 1 / 5 / 0 | 0 / 0 / 0 | 0 / 2 / 0 | 0 / 0 / 0 | 17 / 18 / 0 |
| Non signalés D : coïncide / ignoré / autre | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Textes avec plus de 6 signalements | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| Citations non localisées | 7 | 0 | 0 | 6 | 1 | 0 | 0 | 14 |

## Reproductibilité

```json
{
  "date": "2026-11-11T09:02:15.667Z",
  "figureCheck_sha256": "0558e89c16b1ae6cf9d6a01013283e2c5d5e29602d12d12eae9c3c6a997e221a",
  "script_sha256": "5fdeff0a114adf3d1eb1113b70b58df585db65d60f62ec29f81968200f3ed1c0",
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
