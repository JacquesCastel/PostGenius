# E4 : anonymisation des 70 textes

Script : `scripts/e4-anonymize.mjs` (tests : `scripts/e4-anonymize.test.mjs`). Réalisée le 10 novembre 2026, avant tout classement.

## Ce qui a été fait
1. **Codage** (`build`) : les 70 textes (A, B, AN, BN, C, CN, D × 10 sujets) reçoivent chacun un identifiant aléatoire `T-XXXX` tiré au hasard, sans lien avec la condition. La correspondance identifiant → condition est dans `NE-PAS-OUVRIR-avant-classement/cle-anonymisation.json`.
2. **Lecture des seuls débuts et fins** (`candidates`) : l'assistant n'a lu que le premier et le dernier paragraphe de chaque texte, sous identifiant seul (condition non affichée). Aucun nom d'outil ni de modèle (LinkeePost, ChatGPT, GPT, OpenAI, Anthropic, Claude…) n'apparaît dans les 70 textes : rien à masquer.
3. **Retraits** (`apply`) : seuls des paragraphes entiers, au tout début ou à la toute fin, qui ne font pas partie du post. Décidés sur ce seul critère : l'intitulé du document (« # Post LinkedIn — … », « # Brouillon LinkedIn — … ») et le séparateur `---` qui le suit. **7 textes sur 70**, tous au début (`retraits.md`). Aucune phrase de clôture du type « Souhaitez-vous une version plus courte ? » n'a été trouvée.
4. **Conservés volontairement** : les titres propres au post (par exemple « # Bilan 2024 — … »), les signatures, les hashtags, les appels à réagir, et le texte **T-74TC**, qui commence par « Voici pourquoi je ne peux pas écrire ce post tel que demandé » : c'est un refus, donc un résultat à compter (« nombre de refus »), pas une phrase d'introduction.

## Pour le classement
- Fichier à classer : `lot-classement.md` (textes groupés par sujet, ordre mélangé dans chaque sujet, fiche de faits en regard, condition non indiquée).
- **Ne pas ouvrir** `NE-PAS-OUVRIR-avant-classement/` avant d'avoir terminé son propre classement.
- Empreinte SHA-256 de la clé, calculée avant tout classement (à publier avant le classement) : `6fb57b2ef45d1dabec487beac90cfe2d2ba39200ec7c264860609bf5ee619e99`
- Empreinte SHA-256 de `lot-classement.md` : `370da891e84e37e9fc75454059d5a3759043aa0d630da408af68756a40a00ae8`

## Limites à dire
- L'anonymisation ne cache pas tout : la mise en forme trahit souvent l'origine (emojis, gras en Markdown, signatures, hashtags, longueur des textes, présence ou non de chiffres selon la consigne). Elle n'a pas été homogénéisée, pour ne pas toucher au contenu.
- L'assistant connaît le dispositif et a vu les enregistrements ; l'aveugle n'est donc complet que pour Jacques, tant qu'il n'ouvre pas la clé.
