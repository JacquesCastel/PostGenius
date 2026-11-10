# Gel de la démonstration éditoriale : empreintes SHA-256

**STATUT : à compléter et à publier AVANT la session de génération.** Tout changement d'un seul caractère de l'un de ces fichiers après publication invalide le gel : les empreintes et les générations seraient à refaire.

| Document | Ce qu'il fige | SHA-256 |
|---|---|---|
| `lib/demoEditorialCore.mjs` | le sujet commun, les trois profils (BELVANTE INDUSTRIE, CANTEVEL Conseil, Mathis Vauberlet), le témoin, les consignes de style, la validation | *à calculer au gel* |
| `scripts/demo-editorial.mjs` | le dispositif de génération, d'enregistrement et de publication | *à calculer au gel* |
| `docs/demo-editoriale/protocole-test.md` | le protocole du test d'appariement et ses seuils (40 %, 60 %) | *à calculer au gel* |

Commande :
```bash
sha256sum lib/demoEditorialCore.mjs scripts/demo-editorial.mjs docs/demo-editoriale/protocole-test.md
```

**Règle de choix des textes, écrite avant** : une seule génération par identité (`--runs 1`), **aucun choix** entre plusieurs essais. Une génération n'est relancée que si aucune réponse n'a été reçue (réseau, 429, 5xx) ; chaque relance est consignée. Aucune génération n'est refaite pour obtenir un texte plus flatteur.

**Où publier** : un gist public daté (comme pour E4), avec ces trois fichiers nommés et ce tableau d'empreintes ; puis noter son adresse et l'heure dans `journal-generation.md`.

**Ce que le gel garantit** : que ces fichiers n'ont pas changé depuis la publication. **Ce qu'il ne garantit pas** : qu'aucun texte n'a été trié ; c'est la règle ci-dessus et la publication intégrale des enregistrements qui y répondent.

Les entreprises et la personne de la démonstration sont fictives.
