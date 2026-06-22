import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getFooterPage } from "@/lib/footer-pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mentions légales — LinkeePost" };

export default async function MentionsLegales() {
  const page = await getFooterPage("mentions-legales");
  return (
    <div className="bg-gradient-to-b from-rose-50/60 via-white to-white text-[#1b2a4a] min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-14 flex-1 w-full">
        <Link href="/" className="text-sm text-[#ff5a5f] hover:underline">← Retour à l'accueil</Link>
        <h1 className="text-3xl font-bold mt-4 mb-8">{page.title}</h1>
        <section className="space-y-6 text-sm leading-relaxed">
          {page.sections.map((s, i) => (
            <div key={i}>
              <h2 className="font-semibold text-base mb-2">{s.heading}</h2>
              {s.body.split("\n").map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
