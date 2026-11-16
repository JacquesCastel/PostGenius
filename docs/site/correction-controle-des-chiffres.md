# Correction à publier : ce que fait réellement le contrôle des chiffres (brouillon, non publié)

**Statut : version prête à coller dans l'administration du blog** (`outputs/blog-correction-controle-des-chiffres.md`, testée par `scripts/blog-correction.test.mjs`). Je n'ai pas accès à l'administration : la publication en ligne est un geste de Jacques. Rien n'est envoyé aux testeurs. Date de la correction : écrite le 11 novembre 2026, corrigée en ligne le 12 novembre 2026 (déploiement `08cbf1d`), publication demandée le 16 novembre 2026. À publier seulement après vérification de ce qui était réellement en ligne (le dépôt ne le dit pas : la phrase est entrée dans le code le 28 octobre 2026, une seconde le 30 octobre ; la date de mise en production est inconnue).

## Ce qui était affirmé, et qui était inexact
1. **Page Fonctionnalités, « Votre matière »** : « Chaque chiffre repris doit se retrouver dans une source, citée dans le post ». Inexact : les sources utilisées sont indiquées **à côté** du post, pas dans son texte (la consigne donnée à l'IA lui interdit d'écrire le nom d'une source dans le post). Et le produit ne garantit pas qu'un chiffre est retrouvé dans une source : il **signale** ceux qui sont absents de vos informations.
2. **Page Fonctionnalités, « Seconde vie d'un contenu »** : « chaque chiffre doit se retrouver dans le contenu d'origine ». Inexact pour les posts : ce qui est contrôlé par le code, c'est la **liste des faits** extraits du contenu (un fait n'est gardé que si tous ses chiffres figurent dans la source). Les posts sont ensuite écrits à partir des faits que vous cochez, sur consigne de n'ajouter aucun chiffre : c'est une consigne donnée à l'IA, pas une garantie (je n'ai pas établi si un contrôle de chiffres s'applique ensuite quand la série devient une campagne : l'article ne l'affirme pas).
3. **Deux contrôles de chiffres différents** coexistaient : un pour les posts libres, un autre, moins précis (liste d'unités limitée), pour les campagnes. **Ils sont désormais le même.**

## Ce qui est exact
- Sous un post libre, les chiffres absents des informations fournies (thématique, profil, sources) sont signalés avant publication, avec leur unité. Dans une campagne, le même contrôle s'applique aux informations de la publication et du brief.
- C'est **indicatif** : un chiffre signalé n'est pas forcément faux, un chiffre non signalé n'est pas forcément exact. Les noms propres, les citations et les études citées ne sont pas contrôlés.
- Dans notre test sur 70 textes fictifs (un seul classeur), le contrôle a signalé 78 des 112 chiffres classés inventés ou faux ; cette mesure est **exploratoire** et n'est pas encore publiée (`docs/e4-chiffres/mesure-figurecheck/`).

## Texte proposé (à relire)
> **Correction du 11 novembre 2026.** Notre page Fonctionnalités laissait entendre que chaque chiffre d'un post était retrouvé dans une source citée dans le texte. C'est inexact. Vercéa signale, sous le post, les chiffres qui ne figurent pas dans vos informations ; les sources utilisées sont indiquées à côté du post, pas dans son texte. Ce contrôle est indicatif et vous laisse décider. Nous avons corrigé la page et aligné le contrôle des campagnes sur celui des posts libres.

## Qui alerter : décisions de Jacques
- **Publier la correction** (blog ou rubrique de corrections, avec la date) : brouillon ci-dessus. Cohérent avec l'engagement, resté entre crochets sur la page À propos, de publier toute correction avec sa date.
- **Prévenir les testeurs de la bêta par e-mail** : seulement si la phrase était réellement en ligne dans l'application ou sur le site pendant leur essai. Je ne peux pas l'établir depuis le dépôt et je n'envoie rien.
- Ne pas parler de « correction » sur le site tant que la version corrigée n'est pas déployée.
