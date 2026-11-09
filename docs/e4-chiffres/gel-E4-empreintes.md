# Gel du protocole E4, version 4 : empreintes SHA-256

**Modèle fixé pour A et B : `gpt-6-sol`** (choix de Jacques, 9 novembre 2026). **Statut : prêt à publier, pas encore publié.** Aucune génération ne doit avoir lieu avant la publication de ce fichier et des quatre documents ci-dessous dans un gist **public**, avec leurs noms de fichier.

| Document | SHA-256 |
|---|---|
| `protocole-E4-chiffres-inventes.md` (version 4) | `ad2c3e4d661fe3477d03a271be3971cfa9f5c284738206b5a99939c36be5f116` |
| `fiches-E4-fictives.md` | `ffc46b16057044d43764e5eb71710ad920114de3846347081b2e533f67086425` |
| `consignes-E4-chatgpt-40.md` | `d53de006cc3ca23ef428cf74cdf85247a194a31ea18cfe16d4026a50610bb0f9` |
| `scripts/e4-generate.mjs` | `bb0ef10d5860c32bdcf8dd20e370560bdb0d9f62d10add2251ec00a16701b149` |

Commande : `sha256sum docs/e4-chiffres/protocole-E4-chiffres-inventes.md docs/e4-chiffres/fiches-E4-fictives.md docs/e4-chiffres/consignes-E4-chatgpt-40.md scripts/e4-generate.mjs`

Les fiches et les consignes n'ont pas changé depuis le premier gel (gists du 9 novembre 2026, 12:33 et 12:37, tous deux secrets) : leurs empreintes sont identiques. Seuls le protocole et le script changent.

Les entreprises, personnes et chiffres des fiches sont fictifs ; toute ressemblance avec des personnes ou entreprises réelles serait fortuite.


Commande de génération prévue (A et B) : `node scripts/e4-generate.mjs --provider openai --model gpt-6-sol --out data/e4/run1`. Dans l'environnement de la session, Node doit passer par le proxy : variable `NODE_USE_ENV_PROXY=1`, et `OPENAI_API_KEY` à une valeur factice commençant par `sk-` (le proxy injecte la vraie clé). Ces deux variables sont de l'environnement, pas du script.
