import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { markdownToHtml } from "@/lib/markdown";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

async function getArticle(slug) {
  try {
    return await prisma.article.findUnique({ where: { slug } });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a || !a.published) return { title: "Article — PostGenius" };
  return {
    title: `${a.title} — PostGenius`,
    description: a.excerpt || undefined,
    openGraph: a.coverImage ? { images: [a.coverImage] } : undefined,
  };
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a || !a.published) notFound();

  const html = markdownToHtml(a.content);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/60 via-white to-white text-[#1b2a4a]">
      <SiteHeader />

      <article className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/blog" className="text-sm text-[#ff5a5f] font-medium hover:underline">
          ← Tous les articles
        </Link>
        <h1 className="text-4xl font-bold mt-4 leading-tight">{a.title}</h1>
        <p className="text-sm text-gray-400 mt-3">{a.publishedAt && fmtDate(a.publishedAt)}</p>
        {a.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.coverImage} alt="" className="w-full rounded-2xl mt-6 mb-2" />
        )}
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-12 border-t border-rose-100 pt-8 text-center">
          <p className="font-bold text-lg">Prêt à passer à l'action sur LinkedIn ?</p>
          <Link
            href="/app"
            className="inline-block mt-3 bg-[#ff5a5f] text-white font-semibold px-7 py-3 rounded-full hover:bg-[#f63d44] shadow-lg shadow-rose-300/40"
          >
            Démarrer l'essai gratuit
          </Link>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
