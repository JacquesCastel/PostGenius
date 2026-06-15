// Publie l'article "Score d'engagement" sur le blog (upsert par slug).
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/publish-blog-score.mjs
// (sur le serveur, le .env pointe déjà vers la base de prod)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "score-engagement-linkedin";

const TITLE = "Le score d'engagement : savez-vous si votre post LinkedIn va marcher, avant de le publier ?";

const EXCERPT =
  "LinkeePost note le potentiel de chaque post sur 100, vous explique quoi améliorer critère par critère, et réécrit pour vous l'accroche, le corps ou la signature. Voici comment fonctionne notre score d'engagement.";

const CONTENT = `La plupart des gens publient sur LinkedIn à l'aveugle. On écrit un post, on relit deux fois, on appuie sur « Publier »… et on croise les doigts. Quelques heures plus tard, le verdict tombe : trois likes et un silence poli. Sans savoir, vraiment, ce qui aurait pu changer la donne.

Chez LinkeePost, on a voulu supprimer cette part de hasard. Chaque post que vous générez reçoit un **score d'engagement sur 100**, accompagné d'une explication claire, critère par critère, de ce qui fonctionne et de ce qui peut être amélioré. Voici comment ça marche.

## Une note, mais surtout une explication

Un chiffre seul ne sert à rien. « Votre post vaut 64/100 » : et ensuite ?

C'est pourquoi le score n'est jamais affiché tout seul. À côté de la jauge, LinkeePost détaille **chaque critère** : ce qui est déjà réussi (et pourquoi le garder), et ce qui mérite un coup de pouce (avec un conseil concret pour y arriver). L'objectif n'est pas de vous juger, mais de vous apprendre, post après post, ce qui rend un contenu plus engageant.

## Notre méthode : la vitesse de l'automatique, la finesse de l'IA

Le score repose sur une approche **hybride**, en deux temps.

**1. Une analyse instantanée.** Dès qu'un post est généré, LinkeePost l'évalue en temps réel sur sept critères mesurables, issus des bonnes pratiques observées sur LinkedIn. C'est immédiat, déterministe, et ça ne dépend d'aucun appel externe : la note s'affiche aussitôt.

**2. Des conseils personnalisés par l'IA.** En parallèle, un modèle d'intelligence artificielle lit réellement votre post et ajoute deux à trois recommandations propres à votre contenu — celles qu'une simple grille de critères ne peut pas deviner.

Vous obtenez ainsi le meilleur des deux mondes : la rigueur d'un barème objectif, et l'intelligence d'une relecture sur mesure.

## Les 7 critères qui composent votre score

Le score sur 100 se répartit entre sept critères, chacun avec son poids :

- **Accroche (20 points)** — La première ligne, celle qu'on lit avant le « voir plus ». Courte et porteuse d'une tension (question, chiffre, promesse), c'est elle qui décide si on clique.
- **Longueur & aération (20 points)** — Un texte entre 600 et 1 600 caractères, découpé en courts paragraphes. Un pavé compact décourage ; un texte aéré se lit d'un trait.
- **Question / interaction (15 points)** — Une question ouverte qui invite à réagir. C'est le levier numéro un pour déclencher des commentaires — et l'algorithme adore les commentaires.
- **Hashtags (15 points)** — 2 à 5 hashtags vraiment pertinents : ni zéro, ni une avalanche qui fait spammy.
- **Format (10 points)** — Carrousels et vidéos engagent en moyenne bien plus que le texte seul. On vous le signale quand le sujet s'y prête.
- **Émojis (10 points)** — 1 à 6 émojis pour rythmer et guider l'œil, sans en abuser.
- **Appel à l'action (10 points)** — Une incitation claire en fin de post (« Dites-moi en commentaire… », « Partagez si ça vous parle »).

À chaque critère, vous savez exactement où vous en êtes et comment progresser.

## De la note à l'action : la réécriture ciblée

C'est là que LinkeePost va plus loin qu'un simple « score ». Une fois la note affichée, vous pouvez **appliquer les conseils en un clic** — sans tout réécrire à la main.

Mieux : vous choisissez le **périmètre** de la réécriture. Tout le post, ou seulement l'**accroche**, le **corps** ou la **signature**. L'IA réécrit la partie concernée en gardant votre sujet, votre langue et votre ton, et laisse le reste intact.

Et à chaque modification, **le score se recalcule sous vos yeux** : la jauge s'anime, les critères se mettent à jour, vous voyez immédiatement l'effet de votre changement. Vous pouvez enchaîner les améliorations et regarder la note grimper.

## Rien ne se perd : l'historique des versions

Vous avez préféré l'accroche d'avant ? Aucun souci. Chaque réécriture et chaque édition manuelle sont conservées dans un **historique de versions**, avec leur score respectif. Un clic suffit pour **restaurer** n'importe quelle version. Vous expérimentez sans jamais rien perdre.

## Un indicateur de qualité, pas une boule de cristal

Soyons honnêtes : aucun outil ne peut prédire le nombre exact de vues ou de likes d'un post. La performance réelle dépend aussi de votre réseau, du sujet, du moment de publication.

Le score LinkeePost ne prétend pas deviner l'avenir. Il mesure le **respect des bonnes pratiques** qui, statistiquement, favorisent l'engagement. C'est un copilote : il vous évite les erreurs classiques et vous oriente vers vos meilleurs posts. La décision finale, elle, reste toujours la vôtre.

## Essayez par vous-même

La prochaine fois que vous publierez, vous saurez où vous mettez les pieds — et comment faire mieux.

Pour comprendre notre procédé en détail, découvrez la [page dédiée au score d'engagement](/scoring). Et pour l'essayer sur vos propres posts, [créez votre compte LinkeePost](/app) : 14 jours d'essai gratuit, sans carte bancaire.

*Envie de voir comment tout s'enchaîne, du brief à la publication ? Jetez un œil à [notre fonctionnement étape par étape](/comment-ca-marche).*`;

const article = await prisma.article.upsert({
  where: { slug: SLUG },
  update: { title: TITLE, excerpt: EXCERPT, content: CONTENT, published: true, publishedAt: new Date() },
  create: { slug: SLUG, title: TITLE, excerpt: EXCERPT, content: CONTENT, published: true, publishedAt: new Date() },
});

console.log("\n✅ Article publié :");
console.log("   /blog/" + article.slug);
console.log("   publié :", article.published, "\n");

await prisma.$disconnect();
