// Remplace l'article de blog sur le contrôle de forme par la version corrigée (outputs/blog-score-engagement.md).
// L'ancienne version contient des poids de critères et des seuils faux (20/20/15/15 points, 600 caractères, « 2 à 5 hashtags ») et des affirmations
// sans source ; la nouvelle est alignée sur le code (25/25/10/10/10/10/10, 400 à 1 600 caractères, zéro hashtag valable).
// Ne change QUE le titre, le résumé et le contenu : l'adresse (slug), la date de publication, l'image et l'état publié sont conservés,
// donc les liens existants restent valables.
// Simulation par défaut (aucune écriture) ; ajouter --apply pour enregistrer. Si plusieurs articles correspondent, rien n'est écrit : préciser --slug=…
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - < scripts/blog-remplacer-controle-de-forme.mjs
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - --apply < scripts/blog-remplacer-controle-de-forme.mjs
//   (adresse précise : ... node --input-type=module - --slug=mon-article --apply < ...)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const slugArg = (process.argv.find((a) => a.startsWith("--slug=")) || "").slice(7);

const NEW_TITLE = "Le contrôle de forme : ce que la note de votre post LinkedIn mesure, et ce qu'elle ne mesure pas";
const NEW_EXCERPT = "LinkeePost note la mise en forme de chaque post sur 100, avec sept critères à règles fixes, et vous explique quoi améliorer critère par critère. Ce que cette note mesure, et ce qu'elle ne dit pas.";
const NEW_CONTENT = "Avant de publier un post sur LinkedIn, on le relit deux fois et on se demande si la forme tient : l'accroche, la longueur, l'aération. Difficile de le savoir autrement qu'à l'instinct.\n\nChez LinkeePost, chaque post reçoit une **note de forme sur 100**, accompagnée d'une explication, critère par critère, de ce qui est déjà bien construit et de ce qui peut être amélioré. C'est le **contrôle de forme**. Il dit si un post est bien construit ; il ne dit pas combien de vues il aura. Voici ce qu'il mesure, et ce qu'il ne mesure pas.\n\n## Une note, mais surtout une explication\n\nUn chiffre seul ne sert à rien. « Votre post vaut 64/100 » : et ensuite ?\n\nC'est pourquoi la note n'est jamais affichée toute seule. À côté de la jauge, LinkeePost détaille **chaque critère** : ce qui est déjà réussi, et ce qui mérite un coup de pouce, avec un conseil concret. L'objectif n'est pas de vous juger, mais de vous montrer ce qui, dans la forme, peut être amélioré.\n\n## Notre méthode : une grille fixe, et des conseils de l'IA en plus\n\nLa note repose sur deux éléments distincts.\n\n**1. Une grille de règles fixes.** Dès qu'un post est rédigé, LinkeePost l'évalue sur sept critères de mise en forme que nous avons fixés. C'est immédiat et déterministe : le même texte obtient toujours la même note.\n\n**2. Des conseils de l'IA, en plus.** Un modèle d'intelligence artificielle lit votre post et ajoute deux à trois recommandations propres à son contenu. Ces conseils n'entrent pas dans la note.\n\n## Les 7 critères et leurs poids\n\nLa note sur 100 se répartit entre sept critères :\n\n- **Accroche (25 points)** : la première ligne, celle qu'on lit avant le « voir plus ». Elle doit porter à elle seule l'idée du post, en moins de 90 caractères. Une question ou un « : » peut aider, sans jamais être obligatoire.\n- **Longueur et aération (25 points)** : entre 400 et 1 600 caractères, découpé en courts paragraphes. Un pavé compact décourage la lecture, quelle que soit sa longueur.\n- **Question ou interaction (10 points)** : un bonus, pas une fin imposée. Une question ouverte qui vient naturellement invite aux commentaires ; un post qui conclut sur sa propre idée fonctionne aussi bien.\n- **Hashtags (10 points)** : aucun minimum, zéro hashtag est un choix valable. Au-delà de 5, le texte commence à paraître chargé.\n- **Format (10 points)** : le texte seul est déjà un format efficace quand il est bien écrit. Carrousel ou vidéo restent une option si le sujet s'y prête.\n- **Émojis (10 points)** : de 0 à 6 pour rythmer le texte sans l'alourdir. Zéro émoji obtient la note pleine.\n- **Appel à l'action (10 points)** : si ça vient naturellement, une invitation explicite (« Dites-moi en commentaire… ») peut aider. Un post qui se suffit à lui-même n'en a pas besoin.\n\nÀ chaque critère, vous savez où vous en êtes et ce que vous pouvez changer.\n\n## De la note à l'action : la réécriture ciblée\n\nUne fois la note affichée, vous pouvez **appliquer les conseils en un clic**, sans tout réécrire à la main.\n\nVous choisissez le **périmètre** de la réécriture : tout le post, ou seulement l'**accroche**, le **corps** ou la **signature**. L'IA réécrit la partie concernée en gardant votre sujet, votre langue et votre ton, et laisse le reste intact. À chaque modification, la note se recalcule et vous voyez l'effet de votre changement sur la forme.\n\n## Rien ne se perd : l'historique des versions\n\nVous avez préféré l'accroche d'avant ? Chaque réécriture et chaque édition manuelle sont conservées dans un **historique de versions**, avec leur note. Un clic suffit pour **restaurer** n'importe quelle version.\n\n## Un indicateur de mise en forme, pas une boule de cristal\n\nAucun outil ne peut prédire le nombre de vues ou de réactions d'un post : la performance réelle dépend aussi de votre réseau, du sujet et du moment de publication. La note de forme ne prétend pas deviner l'avenir. Elle mesure le respect de règles de mise en forme que nous avons fixées.\n\nElle ne dit rien non plus du **fond** : un post très bien construit peut contenir un chiffre inventé et obtenir 100 sur 100. Pour cela, LinkeePost propose un autre contrôle, distinct, « Chiffres à vérifier », qui signale les nombres absents des informations que vous avez fournies. La décision finale reste toujours la vôtre.\n\n## Essayer sur vos propres posts\n\nLe contrôle de forme est inclus à partir de l'offre Pro. Pour en savoir plus sur les critères, voyez la [page dédiée au contrôle de forme](/scoring). Pour l'essayer sur vos propres posts, [demandez une invitation à la bêta](/beta).\n\n*Envie de voir comment tout s'enchaîne, du brief à la publication ? Jetez un œil à [notre fonctionnement étape par étape](/comment-ca-marche).*";

const articles = await prisma.article.findMany({ select: { id: true, slug: true, title: true, excerpt: true, content: true, published: true } });
const already = articles.filter((a) => a.title === NEW_TITLE);
// L'ancien article : titre ou texte parlant du « score d'engagement » (ancien nom de la fonction) ou du contrôle de forme
const isOld = (a) => a.title !== NEW_TITLE && (/score d'engagement|contrôle de forme/i.test(a.title) || /Les 7 critères qui composent votre score|score d'engagement sur 100/i.test(a.content));
const candidates = slugArg ? articles.filter((a) => a.slug === slugArg) : articles.filter(isOld);

if (already.length && !slugArg) {
  console.log(`Déjà remplacé : /blog/${already[0].slug} porte déjà le nouveau titre. Rien à faire.`);
} else if (candidates.length !== 1) {
  console.log(candidates.length === 0 ? "Aucun article trouvé. Relancer avec --slug=… si l'adresse est connue." : `${candidates.length} articles correspondent, rien n'est écrit : relancer avec --slug=… parmi :`);
  candidates.forEach((a) => console.log(`  /blog/${a.slug} — ${a.title}${a.published ? "" : " (brouillon)"}`));
} else {
  const a = candidates[0];
  console.log(`Article : /blog/${a.slug}${a.published ? "" : " (brouillon)"}`);
  console.log(`  titre actuel     : ${a.title}`);
  console.log(`  nouveau titre    : ${NEW_TITLE}`);
  console.log(`  contenu          : ${a.content.length} → ${NEW_CONTENT.length} caractères`);
  if (apply) {
    await prisma.article.update({ where: { id: a.id }, data: { title: NEW_TITLE, excerpt: NEW_EXCERPT, content: NEW_CONTENT } });
    console.log("✔ Remplacé. L'adresse, la date de publication, l'image et l'état publié sont inchangés (le cache du blog se renouvelle en quelques minutes).");
  } else {
    console.log("· Simulation : relancez avec --apply pour enregistrer.");
  }
}
await prisma.$disconnect();
