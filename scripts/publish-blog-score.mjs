// Met à jour l'article « Contrôle de forme » du blog (ou le crée s'il n'existe pas), sans changer son adresse ni sa date.
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/publish-blog-score.mjs
// (sur le serveur, le .env pointe déjà vers la base de prod)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "score-engagement-linkedin";

const TITLE = "Le contrôle de forme : ce que la note dit de votre post LinkedIn, et ce qu'elle ne dit pas";

const EXCERPT =
  "LinkeePost vérifie la mise en forme de chaque post avec une grille de règles fixes, y ajoute des conseils de fond proposés par l'IA et réécrit l'accroche, le corps ou la signature. Voici ce que la note mesure, et ce qu'elle ne peut pas mesurer.";

const CONTENT = `On relit son post deux fois, on appuie sur « Publier » et on espère. Quelques heures plus tard, quelques réactions et un silence poli. Difficile de savoir ce qui aurait pu changer la donne : le fond, le moment, le réseau… ou simplement la forme.

La forme, justement, se contrôle. C'est le rôle du **contrôle de forme** de LinkeePost : chaque post reçoit une **note de forme sur 100**, accompagnée d'une explication critère par critère. Cet article détaille ce que cette note mesure, comment elle est calculée, et surtout ce qu'elle ne dit pas.

## Une note, mais surtout une explication

Un chiffre seul ne sert à rien. « Votre post vaut 64/100 » : et ensuite ?

À côté de la jauge, LinkeePost détaille **chaque critère** : ce qui est déjà réussi (et pourquoi le garder), et ce qui mérite un coup de pouce, avec un conseil concret. L'objectif n'est pas de vous juger, mais de vous aider à écrire des posts plus lisibles, un post après l'autre.

## Comment la note est calculée

Deux éléments distincts, qu'il est important de ne pas confondre.

**1. Une grille de règles fixes.** La note sur 100 est calculée par un barème **déterministe** : le même texte obtient toujours la même note. Elle ne dépend d'aucune intelligence artificielle et s'affiche instantanément.

**2. Des conseils de fond proposés par l'IA.** En plus de la grille, un modèle d'IA lit votre post et propose deux ou trois points à ajouter, plutôt sur le fond : un exemple, une précision, une preuve. Ces conseils **ne modifient pas la note** : ils complètent la grille.

Pourquoi le dire aussi clairement ? Parce que les posts générés par LinkeePost suivent les mêmes bonnes pratiques de forme que celles de la grille. Ils obtiennent donc généralement une bonne note de forme, ce qui ne dit rien de leur intérêt pour vos lecteurs. La note est un contrôle de lisibilité, pas un jugement sur la qualité de vos idées.

## Les 7 critères et leur poids

- **Accroche (25 points)** : la première ligne, la seule visible avant le « voir plus ». Elle doit porter à elle seule l'idée du post. Une tension (chiffre, question, « : ») peut aider, sans être obligatoire.
- **Longueur et aération (25 points)** : entre 400 et 1 600 caractères, en courts paragraphes. Un pavé compact décourage la lecture.
- **Question ou interaction (10 points)** : une question ouverte, quand elle vient naturellement, invite aux commentaires. Un post peut aussi se conclure sur sa propre idée.
- **Hashtags (10 points)** : aucun minimum. Zéro hashtag est un choix valable ; au-delà de 5, cela devient pesant.
- **Format (10 points)** : le texte seul est déjà un bon format quand il est bien écrit. Carrousel ou vidéo restent des options si le sujet s'y prête.
- **Émojis (10 points)** : de 0 à 6, pour rythmer le texte sans l'alourdir. Zéro émoji obtient la note pleine.
- **Appel à l'action (10 points)** : une incitation claire peut aider, mais un post qui se suffit à lui-même n'en a pas besoin.

## De la note à l'action : la réécriture ciblée

Une fois la note affichée, vous pouvez **appliquer les conseils en un clic**, sans tout réécrire à la main. Vous choisissez le **périmètre** : tout le post, ou seulement l'**accroche**, le **corps** ou la **signature**. L'IA réécrit la partie concernée en gardant votre sujet, votre langue, votre ton et vos consignes de style, et laisse le reste intact. La note se recalcule à chaque modification.

## Rien ne se perd : l'historique des versions

Vous préférez l'accroche d'avant ? Chaque réécriture et chaque édition manuelle sont conservées dans un **historique de versions**, avec leur note. Un clic suffit pour **restaurer** n'importe quelle version.

## Ce que la note ne mesure pas

Soyons clairs : aucun outil ne peut prédire le nombre de vues ou de réactions d'un post. La performance réelle dépend de votre réseau, du sujet, du moment de la publication, et de la valeur de ce que vous dites.

La note de forme ne prétend donc pas deviner l'avenir. Elle vérifie que votre post est **bien construit et facile à lire**. Pour savoir ce qui fonctionne réellement, regardez les statistiques de vos posts publiés (impressions, réactions, commentaires) : ce sont les retours réels de LinkedIn.

## Essayez par vous-même

Pour le détail du barème, consultez la [page dédiée au contrôle de forme](/scoring). Et pour l'essayer sur vos propres posts, [créez votre compte LinkeePost](/app) : 14 jours d'essai gratuit, sans carte bancaire.

*Envie de voir comment tout s'enchaîne, de la matière que vous déposez jusqu'à la publication ? Jetez un œil à [notre fonctionnement étape par étape](/comment-ca-marche).*`;

// L'article d'origine a une adresse tirée de son ancien titre (« le-score-d-engagement-… ») : on le met à jour sur place
// pour garder son adresse et sa date. Si une copie a été créée sous « score-engagement-linkedin », elle est supprimée.
const found = await prisma.article.findMany({
  where: { OR: [{ slug: SLUG }, { slug: { startsWith: "le-score-d-engagement" } }] },
  orderBy: { publishedAt: "asc" },
});
const keep = found.find((x) => x.slug !== SLUG) ?? found.find((x) => x.slug === SLUG);

let article;
if (keep) {
  article = await prisma.article.update({ where: { id: keep.id }, data: { title: TITLE, excerpt: EXCERPT, content: CONTENT, published: true } }); // date de publication conservée
  for (const dup of found.filter((x) => x.id !== keep.id && x.slug === SLUG)) {
    await prisma.article.delete({ where: { id: dup.id } });
    console.log(`- copie supprimée : /blog/${dup.slug}`);
  }
} else {
  article = await prisma.article.create({ data: { slug: SLUG, title: TITLE, excerpt: EXCERPT, content: CONTENT, published: true, publishedAt: new Date() } });
}

console.log("\n✅ Article à jour :");
console.log("   /blog/" + article.slug);
console.log("   publié :", article.published, "\n");

await prisma.$disconnect();
