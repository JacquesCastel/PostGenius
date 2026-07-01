// Publie l'article "Publier régulièrement sur LinkedIn" sur le blog.
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/publish-blog-regulier.mjs
// (sur le serveur, le .env pointe déjà vers la base de prod)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "publier-regulierement-linkedin";

const TITLE =
  "Comment publier régulièrement sur LinkedIn sans y passer des heures";

const EXCERPT =
  "La régularité est la première cause d'abandon sur LinkedIn. Voici une méthode concrète pour tenir un rythme de publication — sans y consacrer votre dimanche soir.";

const CONTENT = `Tout le monde sait qu'il faut publier régulièrement sur LinkedIn. Et pourtant, la grande majorité des profils actifs publient en rafales — deux semaines intenses, puis un silence de deux mois. Ce n'est pas un manque de volonté. C'est un problème d'organisation.

Voici ce qui bloque, et comment y remédier.

## Pourquoi la régularité est si difficile à tenir

La régularité exige trois choses en même temps : **trouver des idées**, **écrire** et **publier au bon moment**. Si l'une fait défaut, le rythme s'effondre. La plupart des gens buttent sur la première : la page blanche.

S'ajoutent à ça les aléas du quotidien. Un déplacement, une semaine chargée, et on oublie de publier. Puis on culpabilise, on « rattrape » avec un post bâclé, et on se démoralise.

La bonne nouvelle : ce problème se résout avec une méthode, pas avec de la discipline.

## Étape 1 : définir son rythme réel (pas idéal)

Avant de viser trois posts par semaine, demandez-vous honnêtement combien de temps vous pouvez consacrer à LinkedIn chaque semaine. Pas en période de bonne résolution — en période normale.

Pour la plupart des indépendants et consultants, **un post par semaine est déjà excellent**. Mieux vaut un post de qualité toutes les semaines pendant un an qu'une frénésie de dix jours suivie d'un abandon.

Choisissez un créneau fixe — par exemple le mardi matin — et traitez-le comme un rendez-vous client. Pas négociable.

## Étape 2 : créer un stock d'idées, pas un stock de posts

L'erreur classique consiste à vouloir écrire des posts à l'avance. Résultat : des textes qui semblent déjà datés au moment de les publier.

Ce qu'il faut constituer à la place, c'est un **réservoir d'idées** : des fragments, des observations, des questions de clients, des anecdotes. Notez-les au fil de la semaine dans une application simple (Notes, Notion, peu importe). Cinq lignes suffisent.

Quand vient l'heure d'écrire, vous ne partez plus de zéro — vous choisissez dans votre liste.

## Étape 3 : structurer chaque post en moins de 30 minutes

Un post LinkedIn efficace suit presque toujours la même structure :

1. **Une première ligne qui accroche** — une question, un chiffre, une affirmation contre-intuitive. C'est ce qui décide si on clique sur « voir plus ».
2. **Un développement court et aéré** — 4 à 6 paragraphes de 2 à 3 lignes maximum. Pas de pavés.
3. **Une conclusion qui invite à réagir** — une question ouverte ou un appel à l'action clair.

Si vous suivez cette structure, vous pouvez écrire un post de qualité en 20 à 30 minutes. Pas besoin d'inspiration particulière — la structure fait le travail.

## Étape 4 : programmer, pas publier en direct

Publier au bon moment compte. Les créneaux les plus engageants sur LinkedIn se situent généralement le mardi, mercredi ou jeudi, entre 7 h et 9 h ou entre 12 h et 14 h.

Si votre créneau d'écriture ne coïncide pas avec ces horaires, **programmez la publication**. Écrire le lundi soir et programmer pour le mardi matin, c'est exactement ce que font la plupart des créateurs de contenu réguliers.

## Ce que l'IA change (vraiment)

L'intelligence artificielle ne vous dispense pas de réfléchir à ce que vous voulez dire. En revanche, elle efface la page blanche. Vous donnez un sujet, un contexte, votre positionnement — et elle produit une première version à retoucher plutôt qu'un texte à écrire de zéro.

C'est la différence entre relire et rédiger. La relecture prend cinq minutes. La rédaction peut en prendre trente.

Avec un outil comme [LinkeePost](/app), vous décrivez votre activité, votre cible et votre style une seule fois. Ensuite, chaque post généré intègre automatiquement ce contexte. Vous affinez, vous validez — et le post part à l'heure que vous avez choisie.

## Un exemple de routine qui tient

Voici une routine que tiennent des indépendants sur le long terme :

- **Lundi (10 min)** : piocher une idée dans le réservoir et la confier à l'IA.
- **Lundi (10 min)** : relire, ajuster le ton, peaufiner l'accroche.
- **Lundi (2 min)** : programmer pour le mardi 8 h.

Total : 22 minutes par semaine. Un post chaque semaine. Cinquante posts par an.

Au bout d'un an de cette routine, vous avez un corpus de contenu qui témoigne de votre expertise, vous avez été régulier aux yeux de l'algorithme, et votre réseau vous identifie clairement sur votre sujet.

## Ce qu'il ne faut pas faire

- **Publier pour publier** : un post vide de substance fait plus de mal que pas de post. Si vous n'avez rien à dire cette semaine, passez votre tour.
- **Copier les formats viraux** : les carrousels de « 5 erreurs que tout le monde fait » fonctionnent pour ceux qui ont déjà une audience. En partant de zéro, l'authenticité paie plus.
- **Ignorer les commentaires** : répondre aux commentaires dans l'heure qui suit la publication multiplie la portée de votre post. C'est dix minutes qui valent plus que dix posts supplémentaires.

---

La régularité sur LinkedIn n'est pas un exploit de volonté. C'est le résultat d'une méthode simple, appliquée de façon systématique.

Si vous voulez mettre cette méthode en place sans friction, [LinkeePost](/app) est conçu pour ça : profil de rédaction, génération IA, programmation et suivi — tout en un. 14 jours d'essai gratuit, sans carte bancaire.

*Pour aller plus loin : [comment créer une campagne LinkedIn avec l'IA en 5 minutes](/blog/campagne-linkedin-ia).*`;

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
