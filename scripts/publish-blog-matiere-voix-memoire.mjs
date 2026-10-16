// Crée l'article « Pourquoi vos posts LinkedIn doivent partir de ce que vous savez » en BROUILLON (non publié) :
// relecture avec l'onglet Aperçu de l'éditeur d'articles (Administration > Contenu du site > Blog), puis « Publier ».
// Un article dont l'adresse existe déjà n'est jamais écrasé (vos corrections dans l'admin sont préservées) ;
// --force réécrit un brouillon.
//
// Sur le serveur (le dossier scripts/ n'est pas dans l'image : on envoie le script au conteneur par l'entrée standard) :
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - < scripts/publish-blog-matiere-voix-memoire.mjs
// En local : node --env-file=.env scripts/publish-blog-matiere-voix-memoire.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FORCE = process.argv.includes("--force");

const SLUG = "posts-linkedin-partir-de-ce-que-vous-savez";

const TITLE = "Pourquoi vos posts LinkedIn doivent partir de ce que vous savez";

const EXCERPT =
  "Un texte généré à partir de rien ressemble à tous les autres. Matière, voix, mémoire : trois ingrédients pour des posts qui sont vraiment les vôtres, et ce que cela change (et ne change pas) quand on écrit avec une IA.";

const CONTENT = `Ouvrez LinkedIn dix minutes et lisez les posts générés par intelligence artificielle : on les reconnaît presque tous. Une accroche en forme de question, trois idées en liste, une conclusion qui « invite à réfléchir ». Le texte est correct, souvent bien construit. Et il pourrait avoir été écrit par n'importe qui, pour n'importe quelle entreprise.

Le problème n'est pas l'IA. C'est ce qu'on lui donne à lire : presque rien. Quand on demande un post « sur la communication interne », le modèle dispose d'un sujet et d'un ton. Tout le reste, il va le chercher dans une moyenne de ce qui s'écrit partout. Le résultat est une moyenne.

## Ce que vous savez déjà, et que l'IA ne sait pas

Votre entreprise a déjà écrit énormément de choses : des présentations commerciales, un livre blanc, des réponses à des appels d'offres, des articles, des comptes rendus de projets, des échanges avec des clients. Vous avez une façon de parler de votre métier, des mots que vous employez, des mots que vous refusez, des positions que vous défendez.

Rien de cela n'existe pour un générateur de posts qui part d'une page blanche. Et c'est pourtant ce qui rend un post reconnaissable, crédible et utile.

## Trois ingrédients : la matière, la voix, la mémoire

**La matière.** Ce sont les faits : un chiffre issu de votre étude, un cas que vous pouvez raconter, une méthode que vous appliquez réellement. Un post qui s'appuie sur votre matière dit quelque chose de précis, là où un post générique reste dans les généralités.

**La voix.** C'est la façon de le dire : le tutoiement ou le vouvoiement, les mots à privilégier, ceux que vous bannissez (« synergies », « révolutionnaire »), les tournures que vous utilisez naturellement, vos anciens posts comme exemples. Une voix, ce n'est pas un ton choisi dans une liste : c'est un ensemble d'habitudes que l'on reconnaît.

**La mémoire.** C'est ce que vous avez déjà dit. Sans elle, un outil peut vous proposer la même accroche trois semaines de suite, ou contredire un post de la veille. Avec elle, il peut assurer la continuité et éviter les répétitions.

## Comment LinkeePost s'en sert

Dans LinkeePost, vous déposez vos documents, vos liens et vos notes. L'outil en retient des faits et du vocabulaire, que vous relisez et que vous pouvez corriger. Ensuite, pour chaque post :

- il retient les **sources les plus proches du sujet**, par le sens et par les mots, pour ne pas vous noyer dans tout ce que vous avez déposé ;
- il demande au modèle de **reprendre les faits de ces sources fidèlement**, sans les déformer et sans en inventer ;
- il applique vos **consignes de style, vos mots à privilégier et à éviter**, et s'inspire de vos anciens posts pour le rythme et la façon d'ouvrir et de conclure. En cas de conflit avec les règles générales d'écriture, ce sont vos consignes qui priment ;
- il tient compte de **ce que vous avez déjà publié ou programmé**, pour ne pas vous répéter ;
- il **indique les sources utilisées** à côté du post, pour que vous sachiez d'où vient chaque fait.

## Ce que cela ne garantit pas

Soyons précis, parce que c'est là que les promesses des outils d'IA deviennent trompeuses.

Aucune IA n'est infaillible. Un modèle peut mal comprendre un passage, simplifier un chiffre ou rapprocher deux idées qui n'avaient rien à voir. Une source erronée donnera un post erroné. Et un post bien construit n'est pas pour autant un bon post : cela dépend aussi de ce que vous avez à dire.

C'est pourquoi **vous relisez et vous validez**. LinkeePost est conçu pour que cette relecture soit rapide : les sources utilisées sont indiquées, le contrôle de forme repère les problèmes de lisibilité, la validation avant publication vous laisse le dernier mot. Mais la relecture reste la vôtre.

## Pour une agence : un client, une mémoire

Quand on écrit pour plusieurs clients, le risque principal est le mélange : le vocabulaire d'un client qui se glisse chez un autre, un fait qui n'appartient pas à la bonne entreprise. Dans LinkeePost, chaque client a sa propre base de sources, ses propres éléments de langage et sa propre mémoire. Avec le cloisonnement activé, chaque collaborateur ne voit que les clients qui lui sont affectés, et le client valide ses posts depuis un lien, sans compte.

## Par où commencer

Inutile de tout déposer d'un coup. Trois gestes suffisent pour sentir la différence :

1. **Déposez trois à cinq sources de qualité** : votre présentation de l'entreprise, un article dont vous êtes fier, un document qui contient vos chiffres. Le nombre de sources dépend de l'offre (5 en Essentiel, 30 en Pro, 100 par client en Agence), donc mieux vaut commencer par les plus utiles.
2. **Écrivez cinq mots ou expressions à bannir**, et cinq que vous aimez employer. C'est rapide, et l'effet se voit dès le premier post.
3. **Ajoutez quelques anciens posts dont vous êtes satisfait.** Ils servent d'exemples de voix.

Puis générez un post sur un sujet que vos sources couvrent, et comparez-le à ce que vous obtenez d'un générateur sans matière. La différence se lit surtout dans la précision des faits et dans le vocabulaire.

## En résumé

Un bon post LinkedIn n'est pas un texte bien tourné : c'est quelque chose que vous seul pouviez dire, dit comme vous le diriez. L'IA peut vous y aider à condition de partir de ce que vous savez, de respecter votre voix et de se souvenir de ce que vous avez déjà dit.

Pour l'essayer sur votre propre matière, [créez votre compte LinkeePost](/app) : 14 jours d'essai gratuit, sans carte bancaire. Et pour voir le parcours complet, de la matière à la publication, consultez [notre fonctionnement étape par étape](/comment-ca-marche).`;

const existing = await prisma.article.findUnique({ where: { slug: SLUG } });
if (existing && !FORCE) {
  console.log(`= /blog/${SLUG} existe déjà (${existing.published ? "publié" : "brouillon"}) : conservé tel quel`);
} else if (existing?.published) {
  console.log(`! /blog/${SLUG} est publié : --force ne réécrit que les brouillons, ignoré`);
} else {
  await prisma.article.upsert({
    where: { slug: SLUG },
    update: { title: TITLE, excerpt: EXCERPT, content: CONTENT },
    create: { slug: SLUG, title: TITLE, excerpt: EXCERPT, content: CONTENT, published: false },
  });
  console.log(`+ /blog/${SLUG} : brouillon ${existing ? "réécrit" : "créé"}`);
}

console.log("\nRelisez-le dans Administration > Contenu du site > Blog (onglet Aperçu), puis cliquez Publier.");
await prisma.$disconnect();
