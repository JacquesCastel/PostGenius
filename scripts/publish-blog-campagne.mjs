// Publie l'article "Campagne LinkedIn avec l'IA" sur le blog.
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/publish-blog-campagne.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "campagne-linkedin-ia";

const TITLE =
  "Comment créer une campagne LinkedIn avec l'IA en 5 minutes";

const EXCERPT =
  "Une campagne LinkedIn, c'est une série de posts qui progressent vers un message central. Voici comment en lancer une en quelques minutes, avec une structure solide et des posts générés par l'IA.";

const CONTENT = `Publier des posts ponctuels sur LinkedIn, c'est bien. Construire une campagne, c'est mieux. La différence ? Une campagne raconte une histoire sur plusieurs semaines. Chaque post s'appuie sur le précédent et rapproche votre audience d'un message central. C'est ce qui construit vraiment la notoriété et la crédibilité.

Voici comment en créer une — rapidement et sans douleur.

## Ce qu'est (vraiment) une campagne LinkedIn

Une campagne LinkedIn, ce n'est pas un simple calendrier de posts. C'est une **progression narrative** : vous partez d'un problème que votre cible connaît bien, vous déroulez votre point de vue, vous apportez des preuves ou des exemples, et vous concluez sur un message fort.

Exemple : un consultant RH qui veut se positionner sur la marque employeur pourrait construire une campagne en six posts :

1. Le constat : pourquoi la marque employeur est mal comprise
2. L'erreur classique : se concentrer sur les avantages plutôt que sur les valeurs
3. La bonne méthode : comment identifier ses valeurs réelles
4. Un exemple concret (anonymisé)
5. Les indicateurs à suivre
6. Comment commencer dès cette semaine

Chaque post peut se lire seul — mais ensemble, ils positionnent clairement l'auteur comme expert du sujet.

## Étape 1 : choisir un thème précis

La première erreur est de choisir un thème trop large. « Le management » n'est pas un thème de campagne. « Pourquoi vos managers intermédiaires quittent l'entreprise sans rien dire » est un thème de campagne.

Un bon thème de campagne répond à trois critères :
- Il correspond à un problème que votre cible vit en ce moment
- Vous avez un point de vue dessus (pas juste des informations)
- Vous pouvez en parler pendant 4 à 6 posts sans vous répéter

## Étape 2 : cadrer avec l'IA

Une fois le thème choisi, l'IA entre en jeu. Pas pour écrire à votre place — pour cadrer avec vous.

Dans [LinkeePost](/app), quand vous créez une campagne, l'IA vous pose trois à quatre questions de cadrage : quelle est votre cible précise ? Quel message central voulez-vous ancrer ? Quel ton — expert, accessible, provocateur ? Une fois vos réponses données, elle génère un **post d'exemple** qui illustre la direction de la campagne.

C'est votre premier filtre : si ce post d'exemple vous convainc, vous lancez. Sinon, vous ajustez le brief en deux clics.

## Étape 3 : générer et planifier la série

Une fois le brief validé, la série se génère. Vous obtenez quatre à six posts rédigés dans votre style, chacun avec sa propre accroche, son développement et son appel à l'action.

Chaque post est indépendamment modifiable. Vous retouchez ce qui ne sonne pas comme vous. Vous ajustez une date, vous changez l'ordre si vous le souhaitez.

Puis vous programmez : chaque post reçoit sa date et son heure de publication. La campagne tourne toute seule.

## Étape 4 : valider avant chaque publication (ou laisser tourner)

Deux modes de fonctionnement :

**Mode pilote automatique** : vous faites confiance à l'IA. Chaque post part à l'heure prévue sans que vous ayez à intervenir. Idéal pour les créateurs qui veulent se libérer du processus.

**Mode validation** : chaque post vous est soumis 24 h avant sa publication. Vous lisez, vous ajustez si besoin, vous donnez le feu vert. Idéal si vous traitez de sujets sensibles ou si vous voulez garder un œil sur chaque prise de parole.

## Étape 5 : suivre et tirer les leçons

Une campagne ne s'arrête pas à la publication. LinkeePost suit les statistiques de chaque post : vues, likes, commentaires, partages. À la fin de la campagne, vous voyez quels posts ont le mieux fonctionné — et pourquoi.

C'est ce qui améliore les campagnes suivantes. Vous repérez vos formats qui marchent, vos sujets qui engagent le plus, vos créneaux de publication les plus efficaces. Au fil des campagnes, votre contenu s'affine.

## Ce que ça change concrètement

Sans campagne structurée, vous publiez des posts qui n'ont pas de lien entre eux. Votre audience ne sait pas vraiment ce que vous faites, ni pourquoi vous êtes différent. Les likes vont et viennent, sans que vous construisiez grand-chose.

Avec une campagne, chaque post renforce le précédent. Votre positionnement devient clair. Et progressivement, certains profils commencent à vous identifier comme la référence sur votre sujet.

---

Lancer une campagne LinkedIn ne prend pas une journée. Avec un brief clair et un outil adapté, c'est l'affaire de quelques minutes.

[Démarrer votre première campagne gratuitement →](/app)

*Voir aussi : [comment publier régulièrement sur LinkedIn sans y passer des heures](/blog/publier-regulierement-linkedin).*`;

const article = await prisma.article.upsert({
  where: { slug: SLUG },
  update: { title: TITLE, excerpt: EXCERPT, content: CONTENT, published: true, publishedAt: new Date() },
  create: {
    slug: SLUG,
    title: TITLE,
    excerpt: EXCERPT,
    content: CONTENT,
    published: true,
    publishedAt: new Date(),
  },
});

console.log("\n✅ Article publié :");
console.log("   /blog/" + article.slug);
console.log("   publié :", article.published, "\n");

await prisma.$disconnect();
