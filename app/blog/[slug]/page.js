import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { memo, MEMO_TTL } from "@/lib/memoCache";
import { markdownToHtml } from "@/lib/markdown";
import Shell from "@/components/v2/Shell";
import { BRAND_NAME } from "@/lib/brand";
import { JOIN_HREF, pick } from "@/lib/access";

export const dynamic = "force-dynamic";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function getArticle(slug) {
  return memo(`article:${slug}`, MEMO_TTL, () => prisma.article.findUnique({ where: { slug } }), null);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a || !a.published) return { title: `Article — ${BRAND_NAME}` };
  return {
    title: `${a.title} — ${BRAND_NAME}`,
    description: a.excerpt || undefined,
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: {
      type: "article",
      title: a.title,
      description: a.excerpt || undefined,
      publishedTime: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
      ...(a.coverImage ? { images: [a.coverImage] } : {}),
    },
  };
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a || !a.published) notFound();

  const html = markdownToHtml(a.content);

  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.title,
            description: a.excerpt || undefined,
            datePublished: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
            dateModified: new Date(a.updatedAt).toISOString(),
            image: a.coverImage || undefined,
            inLanguage: "fr",
            author: { "@type": "Organization", name: BRAND_NAME },
            publisher: { "@type": "Organization", name: BRAND_NAME },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <article className="max-w-[760px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <Link href="/blog" className="text-sm font-semibold text-[#9E3157] hover:underline">
          ← Tous les articles
        </Link>
        <h1 className="font-display text-[34px] sm:text-[46px] leading-[1.1] tracking-[-0.02em] mt-5">{a.title}</h1>
        {a.publishedAt && <p className="text-sm text-[#6B5A70] mt-4">{fmtDate(a.publishedAt)}</p>}
        {a.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.coverImage} alt="" className="w-full rounded-3xl mt-7" />
        )}
        <div className="prose-v2 mt-9" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-14 border-t border-[#EFE4E0] pt-10 text-center">
          <p className="font-display text-[28px] leading-tight">Prêt à passer à l&apos;action sur LinkedIn ?</p>
          <Link
            href={JOIN_HREF}
            className="inline-block mt-5 bg-[#C2456F] hover:bg-[#9E3157] text-white font-semibold px-8 py-3.5 rounded-full transition-colors"
          >
            {pick("Rejoindre la bêta", "Démarrer l'essai gratuit")}
          </Link>
        </div>
      </article>
    </Shell>
  );
}
