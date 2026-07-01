// Publie l'article "Programmer des posts LinkedIn" sur le blog.
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/publish-blog-programmer.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "programmer-posts-linkedin";

const TITLE =
  "Programmer ses posts LinkedIn : pourquoi, quand et comment le faire efficacement";

const EXCERPT =
  "La programmation est le levier le plus sous-utilisé pour garder un rythme de publication régulier sur LinkedIn. Voici comment en tirer le meilleur parti.";

const CONTENT = `Publier sur LinkedIn « quand on y pense » est la meilleure façon de ne jamais publier régulièrement. La régularité — qui est le principal moteur de visibilité sur LinkedIn — se construit en amont, pas dans l'instant. C'est là qu'intervient la programmation.

## Pourquoi programmer au lieu de publier en direct

La publication impulsive a un problème fondamental : elle dépend de votre disponibilité au bon moment. Si votre créneau idéal est le mardi à 8 h, mais que vous êtes en déplacement, le post ne part pas.

Programmer, c'est dissocier deux moments : **le moment où vous écrivez** (quand vous êtes disponible et inspiré) et **le moment où le post est publié** (quand votre audience est là).

C'est aussi ce qui permet de tenir un rythme sur la durée. Quand vous avez du temps, vous préparez plusieurs posts d'avance. Quand la semaine est chargée, les posts partent quand même.

## Quand publier pour maximiser l'engagement

Il n'existe pas d'heure magique valable pour tout le monde. L'algorithme LinkedIn distribue les posts en fonction des réactions initiales, et ces réactions dépendent de quand votre réseau est actif.

Cela dit, des tendances générales se dégagent sur des millions de posts analysés :

**Les meilleurs jours** : mardi, mercredi et jeudi concentrent la majorité de l'engagement professionnel. Le lundi est chargé (les gens gèrent leurs urgences), le vendredi moins attentif.

**Les meilleurs créneaux** :
- 7 h – 9 h : avant les réunions, le réseau consulte LinkedIn en arrivant au bureau
- 12 h – 14 h : pause déjeuner, fort trafic mobile
- 17 h – 19 h : fin de journée, second pic d'activité

**À éviter** : le week-end (sauf pour les audiences qui travaillent en décalé) et les jours fériés.

Ces créneaux sont des points de départ, pas des règles absolues. Testez, regardez vos statistiques, et ajustez en fonction de ce que vos données vous disent sur votre réseau spécifique.

## Comment organiser sa file de posts

Une bonne organisation de programmation fonctionne en trois niveaux :

**Le stock tampon (1 à 2 semaines)** : ayez toujours une à deux semaines de posts prêts à partir. Si une semaine est chargée ou si une inspiration manque, le rythme ne s'effondre pas pour autant.

**La campagne planifiée (4 à 6 semaines)** : les posts d'une campagne sont générés ensemble, relus ensemble, programmés ensemble. Vous savez exactement ce qui part quand, et les posts se répondent entre eux.

**Les posts réactifs (hors planning)** : une actualité forte, un événement imprévu. Ces posts passent en dehors du planning normal. Ils sont rares mais importants — et ils fonctionnent mieux publiés rapidement, donc en direct ou avec une programmation très courte.

## Ce qui distingue un bon outil de programmation

Tous les outils de programmation LinkedIn ne se valent pas. Les critères à regarder :

**L'API officielle** : seuls les outils qui utilisent l'API officielle de LinkedIn garantissent la stabilité des publications. Les outils qui s'appuient sur des scripts d'automatisation (qui « simulent » des clics sur l'interface) violent les conditions d'utilisation et risquent de bloquer votre compte.

**La gestion de campagne** : programmer des posts isolés, c'est basique. Gérer une série de posts qui s'enchaînent, avec un suivi de l'avancement de chaque campagne, c'est une autre dimension.

**La validation avant publication** : pouvoir relire un post la veille de son départ et le modifier si besoin — ou bloquer sa publication — est une sécurité importante, surtout sur les sujets sensibles.

**Les statistiques** : voir les performances de chaque post programmé (vues, likes, commentaires) depuis le même outil qui a servi à le créer ferme la boucle et permet d'améliorer les campagnes suivantes.

## La programmation dans LinkeePost

Dans [LinkeePost](/app), chaque post généré est accompagné d'un sélecteur de date et d'heure. Une fois votre post relu et validé, vous choisissez le créneau et il est programmé — un seul clic.

Pour une campagne, la programmation est plus puissante : vous définissez les jours et les heures de publication une fois pour toute la campagne (par exemple, « mardi et jeudi à 8 h »), et les posts de la série se placent automatiquement sur le calendrier.

Le mode validation vous envoie une notification 24 h avant chaque publication. Vous vérifiez, ajustez si besoin, approuvez — et le post part à l'heure prévue. Ou vous activez le pilote automatique et LinkeePost publie sans votre intervention.

Toutes les publications se font via l'API officielle LinkedIn, sans jamais toucher à votre mot de passe ou simuler une interaction manuelle.

## Un exemple de semaine type avec la programmation

Voici comment une session de 45 minutes le lundi peut alimenter une semaine entière :

- **Lundi (15 min)** : générer et affiner le post de mardi (veille sur une actualité du secteur)
- **Lundi (15 min)** : générer et affiner le post de jeudi (retour d'expérience ou méthode)
- **Lundi (5 min)** : programmer mardi 8 h et jeudi 8 h
- **Mardi et jeudi matin** : les posts partent automatiquement

Résultat : deux posts par semaine, 45 minutes investies le lundi, zéro stress en cours de semaine.

---

La programmation n'est pas un gadget — c'est l'infrastructure qui rend la régularité possible. Et la régularité, c'est ce qui construit une présence LinkedIn qui compte.

[Commencer à programmer vos posts avec LinkeePost →](/app)

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
