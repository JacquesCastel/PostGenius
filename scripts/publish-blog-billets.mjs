// Crée 3 billets de blog en BROUILLONS (non publiés) : relecture avec l'onglet
// Aperçu de l'éditeur d'articles (Administration > Contenu du site > Blog), puis
// « Publier ». Un billet dont le slug existe déjà n'est jamais écrasé (vos
// corrections dans l'admin sont préservées) ; --force pour réécrire un brouillon.
//
// Sur le serveur (le dossier scripts/ n'est pas dans l'image : on envoie le script
// au conteneur par l'entrée standard, la base de prod est celle de son .env) :
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - < scripts/publish-blog-billets.mjs
// En local : node --env-file=.env scripts/publish-blog-billets.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FORCE = process.argv.includes("--force");

const ARTICLES = [
  // ───────────────────────────────────────────────────────────── 1. Conseils
  {
    slug: "accroche-post-linkedin",
    title: "L'accroche d'un post LinkedIn : comment écrire la seule ligne que tout le monde lit",
    excerpt:
      "Avant le « voir plus », il ne reste qu'une ligne pour retenir le lecteur. Voici comment l'écrire : le principe de la pyramide inversée, cinq formes qui fonctionnent, les erreurs à éviter et une liste de vérification.",
    content: `Vous avez travaillé votre post : un sujet utile, un exemple concret, une conclusion soignée. Puis vous le publiez, et dans le fil, il ne reste de tout cela qu'**une ligne**. Le reste est replié derrière un « voir plus ». Si cette ligne ne donne pas envie, le post n'existe pas.

L'accroche n'est donc pas un détail de style. C'est la partie du post que **tout le monde lit**, et souvent la seule.

## Le principe : la pyramide inversée

Les journalistes connaissent la règle depuis longtemps : l'essentiel d'abord, les détails ensuite, le secondaire à la fin. Un lecteur qui s'arrête au titre doit déjà avoir compris l'information.

Sur LinkedIn, c'est exactement la situation de votre première ligne. Elle doit **porter l'idée du post**, pas seulement l'annoncer.

- Une accroche qui annonce : « Je voudrais vous parler d'un sujet qui me tient à cœur. » On ne sait toujours rien.
- Une accroche qui porte : « Un bon post tient en une idée, pas en dix. » L'idée est là, le lecteur peut déjà réagir ou vouloir la suite.

Le reste du post sert à **prouver et à illustrer** cette idée, pas à la révéler.

## Cinq formes qui fonctionnent

Il n'y a pas de formule magique, et un post qui en suit toujours la même finit par se voir. Mais ces cinq formes reviennent souvent parce qu'elles sont efficaces. Les exemples ci-dessous sont des illustrations.

**1. L'affirmation franche.** Une idée nette, éventuellement à contre-courant.
« Publier tous les jours ne sert à rien si personne n'a envie de vous lire demain. »

**2. La question qui touche juste.** Elle doit concerner directement le lecteur, pas être rhétorique.
« Quand avez-vous relu votre profil LinkedIn pour la dernière fois ? »

**3. Le chiffre précis.** À condition qu'il soit vrai et que vous puissiez le sourcer : un chiffre inventé détruit la confiance.
« Trois posts par semaine pendant six mois : voici ce que j'ai changé. »

**4. La promesse suivie de deux points.** Le signe « : » annonce du concret.
« Un bon post tient en trois choses : une idée, un exemple, une question. »

**5. La petite scène.** Un instant précis, qui place le lecteur dans une situation.
« Mardi, 8 h 45. Un client me dit : "Je n'ai jamais rien publié, par où je commence ?" »

## Les erreurs les plus courantes

- **Commencer par vous** : « Je suis ravi de vous annoncer… » Le lecteur se demande ce que cela change pour lui. Commencez par ce que cela lui apporte.
- **Étirer** : au-delà d'une ligne courte, la phrase est coupée avant la fin. Visez moins de 90 caractères pour que l'idée tienne entièrement avant le « voir plus ».
- **Teaser sans contenu** : « Vous ne devinerez jamais la suite. » Le lecteur averti ne clique pas, et celui qui clique est déçu.
- **Promettre ce que le post ne tient pas** : une accroche qui exagère fait cliquer une fois, jamais deux.
- **Empiler les emojis** : un ou deux peuvent guider l'œil, une rangée fait spam.

## Une liste de vérification avant de publier

Relisez votre première ligne seule, comme si elle était tout ce que le lecteur verrait :

- Est-ce qu'elle porte une idée, pas seulement un sujet ?
- Est-ce qu'elle tient en moins d'une ligne courte ?
- Est-ce qu'un lecteur qui ne lit qu'elle a déjà quelque chose à en retenir ?
- Est-ce que le reste du post tient la promesse ?
- Est-ce qu'elle a l'air écrite pour ce sujet précis, pas pour tous vos posts ?

Si la réponse est non quelque part, réécrivez cette ligne avant de toucher au reste.

## Aller plus vite sur ce travail

Réécrire une accroche trois ou quatre fois est normal, c'est même le bon réflexe. Dans LinkeePost, le score d'engagement note votre première ligne et vous explique ce qui peut l'améliorer. Vous pouvez ensuite **réécrire uniquement l'accroche**, en gardant le corps du post intact, et comparer les versions grâce à l'historique.

Pour voir comment cela fonctionne, découvrez la [page dédiée au score d'engagement](/scoring). Et pour tester sur vos propres posts, [créez votre compte LinkeePost](/app) : 14 jours d'essai gratuit, sans carte bancaire.`,
  },

  // ─────────────────────────────────────────────────────── 2. Cas d'usage
  {
    slug: "publier-video-linkedin",
    title: "Publier une vidéo sur LinkedIn : du script au post, étape par étape",
    excerpt:
      "Plan de tournage, prompteur, import de votre vidéo ou lien YouTube : voici comment passer d'une idée à une vidéo publiée sur LinkedIn avec LinkeePost, et le choix entre vidéo importée et lien YouTube.",
    content: `Beaucoup de gens hésitent à publier une vidéo sur LinkedIn, et ce n'est presque jamais la caméra qui bloque. C'est la page blanche : qu'est-ce que je dis, dans quel ordre, et comment ne pas bafouiller ?

LinkeePost prend en charge les trois temps du travail : **préparer** la vidéo, la **publier**, et choisir entre **une vidéo importée** et **un lien YouTube**. Voici le parcours complet.

## 1. Préparer : le kit de tournage

Créez un post et choisissez le format **Vidéo**. En plus du texte du post, LinkeePost prépare un **kit de tournage**, pour une vidéo de 60 à 90 secondes environ :

- **Les plans** : de six à dix, chacun avec son minutage, les phrases exactes à dire, ce qu'on voit à l'image (cadrage, geste, décor) et, si utile, un court texte à incruster à l'écran.
- **Une accroche** dans les premières secondes et **un appel à l'action** pour finir.
- **Quelques conseils de tournage** adaptés à votre sujet : lumière, cadrage, rythme, sous-titres.

Le texte est écrit pour être **dit**, pas lu : phrases courtes, formulations naturelles à l'oral.

## 2. Tourner : le prompteur

Une fois le script prêt, ouvrez le **prompteur** : le texte s'affiche en grand, plein écran, et défile tout seul. Vous réglez la **vitesse** et la **taille du texte**, vous démarrez et mettez en pause avec la **barre d'espace**, et un mode **miroir** est prévu pour les prompteurs à vitre.

Posez le téléphone ou la caméra, lancez le prompteur, et lisez en regardant l'objectif. Vous pouvez aussi **copier** le plan ou le **télécharger en .txt** pour le garder à portée de main.

Un conseil qui vaut pour tout le monde : filmez **deux prises** et gardez la meilleure. La première sert surtout à se détendre.

## 3. Publier : deux façons

### Votre vidéo importée

Dans l'étape suivante, le bloc **Vidéo du post** vous permet d'importer votre fichier : MP4 ou MOV, **200 Mo au maximum**. Une barre de progression s'affiche, puis un aperçu pour vérifier que c'est la bonne.

Vous pouvez ensuite **publier tout de suite** ou **programmer** le post, comme n'importe quel autre. La vidéo part sur LinkedIn avec votre texte. LinkedIn la traite avant de l'afficher, ce qui peut prendre quelques minutes : c'est normal.

### Un lien YouTube

Votre vidéo est déjà sur YouTube ? Collez simplement son adresse dans le bloc **Lien YouTube**. Un aperçu vous permet de vérifier la bonne vidéo.

Sur LinkedIn, le post affichera une **carte cliquable** avec la miniature et le titre de la vidéo. Précisons une limite : LinkedIn ne lit pas le lecteur YouTube directement dans le fil, un clic renvoie vers YouTube.

## Laquelle choisir ?

- **Vidéo importée** : elle se lit directement dans le fil, sans quitter LinkedIn. C'est le format qui garde le lecteur sur place.
- **Lien YouTube** : pratique pour une vidéo longue, ou qui existe déjà sur votre chaîne. Il amène du trafic vers YouTube, au prix d'un clic de plus.

Un post ne porte **qu'une seule pièce jointe** : une vidéo importée remplace l'image, et il faut retirer le lien YouTube pour importer une vidéo (et inversement).

## Quelques réflexes qui font la différence

- **Les trois premières secondes** décident de la suite : commencez par l'idée, pas par « Bonjour, aujourd'hui je vais vous parler de… ».
- **Sous-titrez** : on regarde souvent les vidéos sans le son, dans les transports ou au bureau.
- **Le texte du post** sert d'introduction à la vidéo, il ne la répète pas. Donnez une raison de lancer la lecture.
- **Posez une question** à la fin du post pour inviter à commenter.

## Essayez

Le meilleur moyen de se lancer est de commencer petit : une vidéo de trente secondes sur un sujet que vous maîtrisez parfaitement. [Créez votre compte LinkeePost](/app) et essayez gratuitement pendant 14 jours, sans carte bancaire.

*Pour voir comment tout s'enchaîne, du brief à la publication, consultez [notre fonctionnement étape par étape](/comment-ca-marche).*`,
  },

  // ─────────────────────────────────────────────── 3. Coulisses / actualités
  {
    slug: "nouveautes-linkeepost-video-youtube",
    title: "Nouveautés LinkeePost : vidéo, kit de tournage, lien YouTube et blog",
    excerpt:
      "Ce que nous venons d'ajouter : publier votre propre vidéo, un kit de tournage avec prompteur, la carte YouTube dans vos posts, des emails aux moments clés, et les lecteurs YouTube dans le blog.",
    content: `Un point rapide sur ce que nous avons ajouté à LinkeePost ces dernières semaines. Rien de spectaculaire à annoncer : des fonctions qui répondent à des demandes concrètes, et que vous pouvez utiliser dès maintenant.

## Publier votre propre vidéo

Vous pouvez désormais joindre une **vidéo** à un post (MP4 ou MOV, 200 Mo maximum), la prévisualiser avant l'envoi, puis la **publier** ou la **programmer** sur LinkedIn, sur votre profil (ou sur une page entreprise avec l'offre Agence). Jusqu'ici, LinkeePost vous aidait à écrire le script ; il vous aide maintenant jusqu'à la publication.

Le fichier est envoyé par morceaux, ce qui évite les échecs sur les connexions un peu lentes, et il est supprimé de nos serveurs quelque temps après la publication.

## Un kit de tournage avec prompteur

Pour un post vidéo, l'IA ne se limite plus à un script : elle prépare un **plan de tournage** avec, pour chaque plan, ce qu'on dit, ce qu'on montre et un éventuel texte à l'écran, plus quelques conseils adaptés à votre sujet.

Le **prompteur** plein écran fait défiler le texte pendant que vous filmez, avec vitesse et taille réglables et un mode miroir. Le plan peut aussi être copié ou téléchargé. Nous en parlons en détail dans [Publier une vidéo sur LinkedIn : du script au post](/blog/publier-video-linkedin).

## Joindre un lien YouTube à un post

Votre vidéo est sur YouTube ? Collez son adresse dans le post : LinkedIn affichera une **carte cliquable** avec la miniature et le titre. Un lecteur d'aperçu vous permet de vérifier que c'est la bonne vidéo avant de publier.

## Des emails aux moments importants

LinkeePost vous écrit désormais à trois moments clés : un **email de bienvenue** à l'inscription, un **rappel avant la fin de l'essai gratuit** (quand il reste trois jours), et un **message en cas d'échec de paiement**, avec un lien vers votre abonnement. Chacun n'est envoyé qu'une seule fois par situation.

## Le blog : lecteurs YouTube intégrés

Côté blog, les liens YouTube collés seuls sur une ligne s'affichent maintenant sous forme de **lecteur intégré**, sans cookie de suivi tant que vous ne lancez pas la lecture. Notre éditeur d'articles propose aussi un onglet **Aperçu** pour vérifier le rendu avant publication.

## La suite

Nous continuons dans la même direction : réduire le temps entre une idée et un post publié. Si une fonction vous manque, [écrivez-nous](/contact) : ce sont vos demandes qui décident de l'ordre.

Pour essayer ce qui précède, [créez votre compte LinkeePost](/app) : 14 jours d'essai gratuit, sans carte bancaire.`,
  },
];

for (const a of ARTICLES) {
  const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
  if (existing && !FORCE) {
    console.log(`= /blog/${a.slug} existe déjà (${existing.published ? "publié" : "brouillon"}) : conservé tel quel`);
    continue;
  }
  if (existing?.published) {
    console.log(`! /blog/${a.slug} est publié : --force ne réécrit que les brouillons, ignoré`);
    continue;
  }
  await prisma.article.upsert({
    where: { slug: a.slug },
    update: { title: a.title, excerpt: a.excerpt, content: a.content },
    create: { slug: a.slug, title: a.title, excerpt: a.excerpt, content: a.content, published: false },
  });
  console.log(`+ /blog/${a.slug} : brouillon ${existing ? "réécrit" : "créé"}`);
}

console.log("\nRelisez-les dans Administration > Contenu du site > Blog (onglet Aperçu), puis cliquez Publier.");
await prisma.$disconnect();
