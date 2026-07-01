// Répartit les dates de publication du blog sur les 5 derniers mois.
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/restamp-blog-dates.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Ordre chronologique voulu + dates espacées d'environ 3 semaines
const DATES = [
  { slug: "publier-regulierement-linkedin",  date: "2026-01-27" },
  { slug: "profil-redaction-linkedin",        date: "2026-02-17" },
  { slug: "campagne-linkedin-ia",             date: "2026-03-10" },
  { slug: "veille-linkedin-contenu",          date: "2026-04-01" },
  { slug: "programmer-posts-linkedin",        date: "2026-04-22" },
  { slug: "score-engagement-linkedin",        date: "2026-05-13" },
];

for (const { slug, date } of DATES) {
  const updated = await prisma.article.updateMany({
    where: { slug },
    data: { publishedAt: new Date(date) },
  });
  const status = updated.count ? `✅  ${date}` : "⚠️  introuvable";
  console.log(`  ${status}  /blog/${slug}`);
}

await prisma.$disconnect();
console.log("\nDates mises à jour.");
