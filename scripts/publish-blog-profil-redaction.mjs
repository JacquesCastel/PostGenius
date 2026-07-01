// Publie l'article "Profil de rédaction LinkedIn" sur le blog.
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/publish-blog-profil-redaction.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "profil-redaction-linkedin";

const TITLE =
  "Le profil de rédaction : comment l'IA apprend à écrire comme vous sur LinkedIn";

const EXCERPT =
  "L'IA ne sait pas qui vous êtes, ni ce que vous faites, ni comment vous parlez. Sans contexte, elle produit des posts génériques. Voici comment configurer un profil de rédaction qui change tout.";

const CONTENT = `On entend souvent : « J'ai essayé ChatGPT pour écrire des posts LinkedIn, ça sonnait faux. » C'est normal. Un modèle d'IA sans contexte produit du contenu générique — des posts qui pourraient appartenir à n'importe qui dans votre secteur.

Le profil de rédaction résout exactement ce problème.

## Pourquoi l'IA écrit mal sans contexte

Un modèle d'IA est entraîné sur des milliards de textes, mais il ne vous connaît pas. Il ne sait pas que vous êtes consultante RH spécialisée dans les PME industrielles. Il ne sait pas que vous vous adressez à des dirigeants qui n'ont jamais externalisé leurs RH. Il ne sait pas que vous préférez un ton direct, sans jargon.

Résultat : il produit un post « consultant RH » — passe-partout, interchangeable, oubliable.

Pour que l'IA écrive pour vous, il faut lui transmettre votre contexte une fois, clairement, de façon structurée.

## Ce que contient un bon profil de rédaction

Un profil de rédaction efficace répond à cinq questions :

**1. Qui êtes-vous professionnellement ?**
Votre activité, votre positionnement, ce qui vous différencie. Pas un résumé de CV — une description de ce que vous faites et pourquoi vous le faites mieux ou différemment que les autres.

**2. À qui vous adressez-vous ?**
Votre cible principale : secteur, taille de structure, rôle, niveau hiérarchique. Plus c'est précis, plus les posts sont pertinents. « Dirigeants de PME industrielles entre 50 et 200 personnes » vaut dix fois mieux que « décideurs ».

**3. Quel est votre marché et son contexte actuel ?**
Les enjeux du moment dans votre secteur, les sujets qui préoccupent votre cible. Ça permet à l'IA d'ancrer vos posts dans une réalité concrète plutôt que dans des généralités.

**4. Quel est votre ton ?**
Direct ? Pédagogique ? Provocateur ? Bienveillant ? Formel ou accessible ? Un exemple de post que vous avez déjà écrit et que vous aimez est souvent plus parlant qu'un adjectif.

**5. Quel est votre rythme et vos objectifs ?**
Combien de fois par semaine vous souhaitez publier, et ce que vous cherchez à obtenir sur LinkedIn : visibilité, leads, recrutements, crédibilité ?

## Ce que ça change dans les posts générés

Avec un profil rempli, l'IA n'écrit plus des posts LinkedIn génériques. Elle écrit des posts qui :

- **Parlent directement à votre cible** — les exemples, les problématiques, le vocabulaire choisi correspondent au monde de vos lecteurs
- **Portent votre point de vue** — pas une liste de faits neutres, mais une prise de position ancrée dans votre positionnement
- **Sonnent comme vous** — le registre de langue, le niveau de technicité, la façon de conclure correspondent à ce qu'on attend de vous

La différence entre un post généré avec et sans profil est, en pratique, très visible. Le premier ressemble à un post LinkedIn. Le second ressemble à votre post LinkedIn.

## Comment construire son profil (et l'affiner)

Dans [LinkeePost](/app), le profil de rédaction se remplit en quelques minutes depuis la page Profil. Vous répondez à des champs guidés — activité, cible, marché, ton, exemples de posts.

Si vous avez un site ou une page LinkedIn, vous pouvez laisser l'IA analyser votre contenu existant pour préremplir les champs : elle extrait votre positionnement, votre vocabulaire, vos sujets habituels. Vous n'avez plus qu'à vérifier et compléter.

Le profil n'est pas figé. Au fil du temps, à mesure que vous affinez votre positionnement ou que vous changez de cible, vous le mettez à jour. Tous les futurs posts intègrent automatiquement la nouvelle version.

## L'erreur à éviter : trop vague ou trop long

Un profil de rédaction trop vague (« je suis consultant en management ») donne des posts vagues. Mais un profil trop long et trop détaillé noie l'IA dans les informations.

Le bon équilibre : précis sur l'essentiel (cible, différenciation, ton), concis sur le reste. Trois lignes claires sur votre activité valent mieux qu'une page de description.

## Un investissement de cinq minutes, payant pour toujours

Le profil de rédaction est la seule chose que vous configurez une fois dans LinkeePost. Après ça, chaque post, chaque campagne bénéficie automatiquement de ce contexte.

C'est ce qui transforme un générateur de texte en véritable assistant éditorial : un outil qui vous connaît, qui écrit dans votre style, et qui sait à qui il s'adresse.

---

[Créez votre profil de rédaction et générez votre premier post →](/app)

*Voir aussi : [comment créer une campagne LinkedIn avec l'IA en 5 minutes](/blog/campagne-linkedin-ia).*`;

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
