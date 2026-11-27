import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/v2/Shell";
import { BRAND_NAME } from "@/lib/brand";
import { getFooterPage } from "@/lib/footer-pages";
import { legalOuvert } from "@/lib/siteInstitutionnel";
import { liaisons, liaisonsEm } from "@/lib/typo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Informations légales — ${BRAND_NAME}`,
  description: "Mentions légales, conditions générales d'utilisation et politique de confidentialité.",
  alternates: { canonical: "/legal" },
};

// Le texte vient des mêmes pages que /mentions-legales, /cgu et /confidentialite (éditables en administration) : rien n'est recopié ici.
const BLOCS = [
  ["mentions-legales", "mentions", "Mentions légales"],
  ["cgu", "cgu", "Conditions générales d'utilisation"],
  ["confidentialite", "confidentialite", "Confidentialité"],
];

export default async function LegalPage() {
  const pages = await Promise.all(BLOCS.map(([cle]) => getFooterPage(cle)));
  const textes = pages.flatMap((p) => p.sections.flatMap((s) => [s.heading, s.body]));
  if (!legalOuvert(process.env, textes)) notFound(); // fermée : interrupteur absent, ou un champ « À COMPLÉTER » reste dans un texte
  const titre = liaisonsEm("Qui nous sommes,", "ce que vous acceptez, ce que nous faisons de vos données.");
  return (
    <Shell>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-3">Informations légales</p>
        <h1 className="font-display text-[34px] sm:text-[48px] leading-[1.08] tracking-[-0.02em] max-w-[860px]">{titre[0]}<em className="text-[#C2456F]">{titre[1]}</em></h1>

        <div className="mt-10 flex flex-wrap gap-10 items-start">
          <nav aria-label="Sommaire" className="flex-[0_0_240px] md:sticky md:top-6 bg-white border border-[#EFE4E0] rounded-3xl p-5 flex flex-col gap-2 text-[15px]">
            <strong className="text-xs uppercase tracking-[0.08em] text-[#6B5A70]">Sur cette page</strong>
            {BLOCS.map(([, ancre, titre2]) => <a key={ancre} href={`#${ancre}`} className="text-[#9E3157] hover:text-[#7A2342]">{titre2}</a>)}
            <strong className="text-xs uppercase tracking-[0.08em] text-[#6B5A70] mt-3">Ailleurs sur le site</strong>
            <Link href="/securite" className="text-[#9E3157] hover:text-[#7A2342]">Sécurité et données</Link>
            <Link href="/privacy-policy" className="text-[#9E3157] hover:text-[#7A2342]">Privacy policy (English)</Link>
          </nav>
          <div className="flex-[1_1_520px] min-w-0 flex flex-col gap-14">
            {BLOCS.map(([, ancre, titre2], i) => (
              <section key={ancre} id={ancre} className="scroll-mt-6">
                <h2 className="font-display text-[28px] sm:text-[34px] tracking-[-0.015em] mb-5">{liaisons(titre2)}</h2>
                <div className="flex flex-col gap-5">
                  {pages[i].sections.map((s, k) => (
                    <div key={k} className="bg-white border border-[#EFE4E0] rounded-3xl p-6">
                      <h3 className="font-semibold text-[17px] mb-2">{s.heading}</h3>
                      {s.body.split("\n").map((ligne, j) => <p key={j} className="text-[15px] leading-[1.7] text-[#4A3A50]">{ligne}</p>)}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <p className="mt-12 text-sm text-[#6B5A70]">Une question, un droit à exercer ? <Link href="/contact" className="font-semibold text-[#9E3157] underline">Écrivez-nous</Link>. La version anglaise de la politique de confidentialité garde sa propre adresse, celle déclarée à LinkedIn.</p>
      </div>
    </Shell>
  );
}
