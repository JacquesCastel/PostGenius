import Link from "next/link";
import { prisma } from "@/lib/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// Rendu à la requête : pas de lecture base au build (DB factice en build Docker)
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog — LinkeePost",
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
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50 text-[#1b2a4a] flex flex-col">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full">
        <h1 className="text-4xl font-extrabold mb-2">Le blog</h1>
        <p className="text-[#5a6b85] mb-10">Conseils et stratégies pour réussir sur LinkedIn.</p>

        {articles.length === 0 ? (
          <p className="text-gray-400">Aucun article pour le moment. Revenez bientôt !</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                href={`/blog/${a.slug}`}
                className="block bg-white rounded-3xl border border-white shadow-lg shadow-rose-100/40 overflow-hidden hover:-translate-y-1 transition-transform"
              >
                {a.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverImage} alt="" className="w-full h-44 object-cover" />
                )}
                <div className="p-5">
                  <p className="text-xs text-gray-400">{a.publishedAt && fmtDate(a.publishedAt)}</p>
                  <h2 className="font-bold text-lg mt-1">{a.title}</h2>
                  {a.excerpt && <p className="text-sm text-[#5a6b85] mt-2 line-clamp-3">{a.excerpt}</p>}
                  <span className="text-sm text-[#ff5a5f] font-semibold mt-3 inline-block">Lire →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
