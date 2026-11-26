import Shell from "@/components/v2/Shell";
import { getFooterPage } from "@/lib/footer-pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sécurité et confidentialité — Vercéa", description: "Où sont hébergées vos données, comment elles sont protégées, ce que Vercéa peut et ne peut pas faire avec LinkedIn et avec les assistants IA.", alternates: { canonical: "/securite" } };

export default async function Securite() {
  const page = await getFooterPage("securite");
  return (
    <Shell>
      <div className="max-w-[860px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-3">Sécurité</p>
        <h1 className="font-display text-[34px] sm:text-[48px] leading-[1.08] tracking-[-0.02em]">{page.title}</h1>
        <section className="mt-10 flex flex-col gap-4">
          {page.sections.map((s, i) => (
            <div key={i} className="bg-white border border-[#EFE4E0] rounded-3xl p-6">
              <h2 className="font-semibold text-[17px] mb-2">{s.heading}</h2>
              {s.body.split("\n").map((line, j) => (
                <p key={j} className="text-[15px] leading-relaxed text-[#4A3A50]">{line}</p>
              ))}
            </div>
          ))}
        </section>
      </div>
    </Shell>
  );
}
