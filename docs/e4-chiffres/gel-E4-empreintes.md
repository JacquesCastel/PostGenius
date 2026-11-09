# Gel du protocole E4, version 4 : empreintes SHA-256

Établi le 9 novembre 2026, **avant toute génération valable** (la première tentative, non conforme, est écartée : voir le journal). Ces empreintes identifient exactement les documents et l'outil du test. Tout changement d'un seul caractère modifie l'empreinte.

| Fichier du gist | SHA-256 |
|---|---|
| `protocole-E4-chiffres-inventes.md` (version 4) | `c763dc3cf72b26e1fbdea21af551652bc7f6941910c3d2b9c15aa1c7b36149a1` |
| `fiches-E4-fictives.md` | `ffc46b16057044d43764e5eb71710ad920114de3846347081b2e533f67086425` |
| `consignes-E4-chatgpt-40.md` | `d53de006cc3ca23ef428cf74cdf85247a194a31ea18cfe16d4026a50610bb0f9` |
| `e4-generate.mjs` (script de génération) | `99036939fd4c6c87bfca82aa0a6da58c0d42cc18bac7036bdea68c51f1d3832f` |

**Modèles et moteur.** Conditions A et B : API OpenAI, modèle `gpt-5.5-2026-04-23`, un seul message utilisateur, aucun message système, paramètres par défaut, plafond de sortie 4 000 jetons. Conditions C et D : code de `main` au commit `421c37f` (moteur A par défaut) pour C ; modèle de LinkeePost appelé directement pour D. 10 sujets, 4 conditions chiffrées (A, B, C, D) et 3 conditions neutres (A, B, C), soit 70 textes.

**Ce que le gel garantit** : que ces documents n'ont pas été modifiés après la publication de cette page. **Ce qu'il ne garantit pas** : qu'aucun texte n'a été trié ou écarté ensuite ; c'est la règle « une seule génération, aucune régénération, aucune sélection » et la publication intégrale des résultats qui y répondent.

Les entreprises, personnes et chiffres des fiches sont fictifs ; toute ressemblance avec des personnes ou entreprises réelles serait fortuite.

Vérifier soi-même (les cinq fichiers du gist, sous leurs noms) : `sha256sum protocole-E4-chiffres-inventes.md fiches-E4-fictives.md consignes-E4-chatgpt-40.md e4-generate.mjs`
