# Contrôle des chiffres après génération (6 novembre 2026)

Modifications faites avant un nouveau test du moteur. **Les prompts du moteur A et des moteurs B, B2, B2b ne sont pas modifiés** : leurs empreintes (`scripts/engine-b*.test.mjs`) passent toujours, la référence mesurée (A : 13 textes sur 18 avec invention) reste donc reproductible.

## Ce qui change
1. **Score** (`lib/linkedinRules.js`, `TENSION_REGEX`) : un chiffre dans la première ligne ne donne plus de bonus d'accroche (question ou « : » seulement). Textes d'aide du score et de `/scoring` alignés.
2. **Prompt des variantes** (`app/api/generate/route.js`) : l'exemple d'angle « chiffre choc » est remplacé par « constat, prise de position » et la consigne « n'utilise un chiffre que s'il figure dans les informations fournies » est ajoutée. Ce prompt n'est pas couvert par les empreintes ; il n'a pas été mesuré.
3. **Alerte « Chiffres à vérifier »** : le serveur renvoie `figureBase` (les nombres des informations fournies : thématique, profil, sources, remarques, consignes ; **pas** le texte retouché) ; le navigateur signale les nombres du post absents de cette base (`lib/figureCheck.js`, test `scripts/figure-check.test.mjs`).

## Limites connues
- **Indicatif et numérique seulement.** Il ne voit ni les inventions sans chiffre (ancienneté, durée « depuis longtemps », pratique interne, engagement futur, citation), qui sont la majorité de celles relevées par l'évaluation (`synthese-explo.md`, `synthese-arbitrage-verificateur-IA.md`), ni un chiffre déformé dont la valeur figure ailleurs dans les sources.
- Les chiffres isolés de moins de deux chiffres sans unité, les années seules, les adresses et les hashtags sont ignorés.
- La base inclut la mémoire éditoriale et les posts précédents de l'auteur : un chiffre déjà publié est considéré comme connu.
- Pas de mesure de l'effet : à mesurer avec le protocole existant (taux de textes avec chiffre signalé contre chiffres réellement inventés).

## Non modifié, à décider
- La phrase de l'accroche du prompt (« Une question, un chiffre ou un « : » peuvent l'aider à percuter… ») : la modifier change les empreintes de A, B, B2 et B2b et casse la comparabilité avec les mesures faites.
- Les boutons « Cite un chiffre » et « Plus concret : un exemple, un chiffre ou un cas type » (`app/app/page.js`).
- L'argument marketing « Aucun chiffre inventé » (`components/BrandMotion.js`), contredit par l'évaluation.
