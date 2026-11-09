# Complément au gel du test E4 : condition C

Complément au gel du 9 novembre 2026 (gist https://gist.github.com/JacquesCastel/6daaff4e0f2b2189ddaed9f773e28f40). Publié **avant** la génération de la condition C. Le gel de départ (protocole, fiches, consignes, script `e4-generate.mjs`) n'est pas modifié.

| Fichier du gist | SHA-256 |
|---|---|
| `e4-generate-c.mjs` (script de la condition C) | `fbf363e3881e99489f0b6f48db58f9986ed3b8bb4ef6167189cd5def21f73f4b` |
| `README-C.md` (mode d'emploi et choix) | `8dd2dac07c5708f0f08606e4d745e203cb50c787df61d53d0126def4c683bccd` |

**Paramètres fixés.** 20 textes (`C-S01` à `C-S10`, `CN-S01` à `CN-S10`) ; vrai moteur LinkeePost (`POST /api/generate`), moteur A par défaut, sans `EDITORIAL_ENGINE` ; consigne de base `A-Sxx` / `AN-Sxx` du fichier gelé transmise mot pour mot comme thème ; fiche transmise comme matière source ; profil neutre unique (titre « Professionnel B2B », style « Ton sobre et direct. Phrases courtes. ») ; **`maxChars` = 1700** ; une génération par texte, aucune régénération ni sélection ; code du dépôt : commit noté dans chaque enregistrement.

**Date et heure de publication de ce complément :** ______ (à remplir par Jacques)

Vérifier soi-même : `sha256sum e4-generate-c.mjs README-C.md`
