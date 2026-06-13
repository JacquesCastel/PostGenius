import Link from "next/link";
import { prisma } from "@/lib/db";

// Rendu à la requête : pas de lecture base au build (DB factice en build Docker)
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog — PostGenius",
  description: "Conseils et stratégies pour réussir sur LinkedIn : contenu, campagnes, régularité et engagement.",
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogIndex() {
  let articles = [];
  try {
    articles = await prisma.article.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
    });
  } catch {
    articles = [];
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            PostGenius
          </Link>
          <Link href="/app" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            Essai gratuit
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Le blog</h1>
        <p className="text-gray-500 mb-10">Conseils et stratégies pour réussir sur LinkedIn.</p>

        {articles.length === 0 ? (
          <p className="text-gray-400">Aucun article pour le moment. Revenez bientôt !</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {articles.map((a) => (
              <Link
                key={a.id}
                href={`/blog/${a.slug}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {a.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverImage} alt="" className="w-full h-44 object-cover" />
                )}
                <div className="p-5">
                  <p className="text-xs text-gray-400">{a.publishedAt && fmtDate(a.publishedAt)}</p>
                  <h2 className="font-semibold text-lg mt-1">{a.title}</h2>
                  {a.excerpt && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{a.excerpt}</p>}
                  <span className="text-sm text-indigo-600 font-medium mt-3 inline-block">Lire →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
