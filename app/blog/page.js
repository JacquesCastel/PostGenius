import Link from "next/link";
import { prisma } from "@/lib/db";
import { memo, MEMO_TTL } from "@/lib/memoCache";
import Shell from "@/components/v2/Shell";
import { JOIN_HREF, pick } from "@/lib/access";
import { BRAND_NAME } from "@/lib/brand";

// Rendu à la requête : pas de lecture base au build (DB factice en build Docker)
export const dynamic = "force-dynamic";

export const metadata = {
  title: `Blog — ${BRAND_NAME}`,
  description: "Conseils et stratégies pour réussir sur LinkedIn : contenu, campagnes, régularité et engagement.",
  alternates: { canonical: "/blog" },
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Aplats de couverture quand un article n'a pas d'image : alternance de trois teintes du nouveau style
const TINTS = ["#F6E3E0", "#DCE9DF", "#FCE6D6"];

// Nouveau style (v2). Les données sont celles de la base (articles publiés) ; aucune catégorie, recherche ni lettre d'information.
export default async function BlogIndex() {
  const articles = await memo("blog:list", MEMO_TTL, () => prisma.article.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" } }), []);
  const [featured, ...rest] = articles;

  return (
    <Shell>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F]">Blog</p>
        <h1 className="font-display text-[40px] sm:text-[56px] leading-[1.06] tracking-[-0.02em] mt-3">Le blog</h1>
        <p className="text-[19px] text-[#4A3A50] mt-5 max-w-2xl leading-relaxed">Conseils et stratégies pour réussir sur LinkedIn : contenu, campagnes, régularité et engagement.</p>

        {articles.length === 0 ? (
          <p className="text-[#6B5A70] mt-12">Aucun article pour le moment. Revenez bientôt !</p>
        ) : (
          <>
            <Link href={`/blog/${featured.slug}`} className="mt-12 flex flex-wrap bg-white border border-[#EFE4E0] rounded-[32px] overflow-hidden shadow-[0_18px_40px_rgba(46,31,51,0.07)] hover:border-[#C2456F] transition-colors" data-testid="blog-featured">
              {featured.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.coverImage} alt="" className="flex-[1_1_340px] min-h-[260px] w-full sm:w-auto object-cover" />
              ) : (
                <div className="flex-[1_1_340px] min-h-[260px] bg-[#F6E3E0]" aria-hidden="true" />
              )}
              <div className="flex-[1.3_1_420px] p-8 sm:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-3.5">
                  <span className="text-xs font-semibold bg-[#F6E3E0] text-[#7A2342] px-3 py-1 rounded-full">À la une</span>
                  {featured.publishedAt && <span className="text-[13px] text-[#6B5A70]">{fmtDate(featured.publishedAt)}</span>}
                </div>
                <h2 className="font-display text-[28px] sm:text-[34px] leading-[1.15]">{featured.title}</h2>
                {featured.excerpt && <p className="text-base text-[#4A3A50] leading-relaxed mt-3.5 mb-5">{featured.excerpt}</p>}
                <span className="font-semibold text-[#9E3157]">Lire l&apos;article →</span>
              </div>
            </Link>

            {rest.length > 0 && (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((a, i) => (
                  <Link key={a.id} href={`/blog/${a.slug}`} className="block bg-white border border-[#EFE4E0] rounded-[28px] overflow-hidden hover:border-[#C2456F] transition-colors">
                    {a.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverImage} alt="" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="h-40" style={{ background: TINTS[i % TINTS.length] }} aria-hidden="true" />
                    )}
                    <div className="p-6">
                      {a.publishedAt && <p className="text-xs text-[#6B5A70]">{fmtDate(a.publishedAt)}</p>}
                      <h2 className="text-[19px] font-semibold leading-snug mt-2">{a.title}</h2>
                      {a.excerpt && <p className="text-sm text-[#4A3A50] leading-relaxed mt-2.5 line-clamp-3">{a.excerpt}</p>}
                      <span className="text-sm font-semibold text-[#9E3157] mt-3.5 inline-block">Lire →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-20 bg-[#F6E3E0] rounded-[36px] p-8 sm:p-12 flex flex-wrap gap-8 items-center justify-between">
          <div className="flex-[1_1_380px] min-w-0">
            <h2 className="font-display text-[30px] sm:text-[34px] leading-[1.1]">Prêt à passer à l&apos;action sur LinkedIn ?</h2>
            <p className="text-base text-[#4A3A50] mt-2.5 leading-relaxed">{pick("Accès offert aux testeurs invités, sans carte bancaire.", "14 jours d'essai gratuit, sans carte bancaire.")}</p>
          </div>
          <Link href={JOIN_HREF} className="bg-[#C2456F] hover:bg-[#9E3157] text-white font-semibold px-8 py-4 rounded-full transition-colors">{pick("Demander une invitation", "Démarrer l'essai gratuit")}</Link>
        </div>
      </div>
    </Shell>
  );
}
