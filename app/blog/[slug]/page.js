import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { markdownToHtml } from "@/lib/markdown";

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
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            PostGenius
          </Link>
          <Link href="/app" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            Essai gratuit
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/blog" className="text-sm text-indigo-600 hover:underline">
          ← Tous les articles
        </Link>
        <h1 className="text-4xl font-bold mt-4 leading-tight">{a.title}</h1>
        <p className="text-sm text-gray-400 mt-3">{a.publishedAt && fmtDate(a.publishedAt)}</p>
        {a.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.coverImage} alt="" className="w-full rounded-2xl mt-6 mb-2" />
        )}
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-12 border-t border-gray-100 pt-8 text-center">
          <p className="font-semibold text-lg">Prêt à passer à l'action sur LinkedIn ?</p>
          <Link
            href="/app"
            className="inline-block mt-3 bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-indigo-700"
          >
            Démarrer l'essai gratuit
          </Link>
        </div>
      </article>
    </div>
  );
}
