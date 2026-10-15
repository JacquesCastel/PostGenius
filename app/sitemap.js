import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const SITE = (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");

const PAGES = [
  ["/", 1],
  ["/fonctionnalites", 0.9],
  ["/comment-ca-marche", 0.8],
  ["/scoring", 0.7],
  ["/tarifs", 0.9],
  ["/blog", 0.8],
  ["/contact", 0.5],
  ["/mentions-legales", 0.2],
  ["/cgu", 0.2],
  ["/confidentialite", 0.2],
  ["/privacy-policy", 0.2],
];

// Pages publiques + articles de blog publiés
export default async function sitemap() {
  let articles = [];
  try {
    articles = await prisma.article.findMany({ where: { published: true }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" } });
  } catch {
    // Base indisponible : le plan du site reste valable avec les pages fixes
  }
  return [
    ...PAGES.map(([path, priority]) => ({ url: `${SITE}${path}`, priority })),
    ...articles.map((a) => ({ url: `${SITE}/blog/${a.slug}`, lastModified: a.updatedAt, priority: 0.6 })),
  ];
}
