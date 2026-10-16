// Aligne les articles déjà publiés sur le vocabulaire du site : « score d'engagement » devient « contrôle de forme ».
// Ne touche ni aux titres, ni aux adresses, ni aux dates ; ne change que les phrases listées ci-dessous.
// Simulation par défaut (aucune écriture) ; ajouter --apply pour enregistrer.
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - < scripts/blog-aligner-axe.mjs
//   cd /opt/postgenius && docker compose exec -T app node --input-type=module - --apply < scripts/blog-aligner-axe.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

// Remplacements, du plus précis au plus général
const REPLACEMENTS = [
  ["le score d'engagement note votre première ligne et vous explique ce qui peut l'améliorer", "le contrôle de forme vérifie votre première ligne et vous explique ce qui peut l'améliorer"],
  ["[page dédiée au score d'engagement](/scoring)", "[page dédiée au contrôle de forme](/scoring)"],
  ["Le score d'engagement", "Le contrôle de forme"],
  ["le score d'engagement", "le contrôle de forme"],
  ["Score d'engagement", "Contrôle de forme"],
  ["score d'engagement", "contrôle de forme"],
];

const articles = await prisma.article.findMany({ select: { id: true, slug: true, title: true, excerpt: true, content: true, published: true } });
let changed = 0;
for (const a of articles) {
  let content = a.content, excerpt = a.excerpt ?? "";
  let n = 0;
  for (const [from, to] of REPLACEMENTS) {
    const parts = content.split(from);
    if (parts.length > 1) { n += parts.length - 1; content = parts.join(to); }
    const ex = excerpt.split(from);
    if (ex.length > 1) { n += ex.length - 1; excerpt = ex.join(to); }
  }
  if (!n) continue;
  changed++;
  console.log(`${apply ? "✔" : "·"} /blog/${a.slug} : ${n} remplacement(s)${a.published ? "" : " (brouillon)"}`);
  if (apply) await prisma.article.update({ where: { id: a.id }, data: { content, excerpt: a.excerpt == null ? undefined : excerpt } });
}
console.log(changed ? `\n${changed} article(s) ${apply ? "mis à jour" : "à mettre à jour : relancez avec --apply"}.` : "\nAucun article à modifier.");
await prisma.$disconnect();
