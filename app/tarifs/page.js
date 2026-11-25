import Link from "next/link";
import { Check, Minus, ChevronRight } from "lucide-react";
import { getLanding } from "@/lib/landing";
import { PLANS, PLAN_IDS } from "@/lib/plans";
import { COMPARE } from "@/lib/planFeatures";
import Shell from "@/components/v2/Shell";
import PricingCards from "@/components/PricingCards";
import { JOIN_HREF, pick } from "@/lib/access";
import { liaisons } from "@/lib/typo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tarifs — LinkeePost",
  description:
    "Trois offres pour des posts LinkedIn écrits à partir de votre matière : Essentiel, Pro et Agence. " + pick("Accès sur invitation pendant la bêta fermée.", "14 jours d'essai gratuit, sans carte bancaire."),
  alternates: { canonical: "/tarifs" },
};

function Cell({ v }) {
  if (v === true) return <Check size={18} className="text-[#C2456F] mx-auto" />;
  if (v === false) return <Minus size={16} className="text-[#C9BBC4] mx-auto" />;
  return <span className="font-semibold">{v}</span>;
}

export default async function TarifsPage() {
  const { plans } = await getLanding();
  // Prix/textes éditables (getLanding) indexés par id de plan
  const cardByName = Object.fromEntries(plans.map((p) => [p.name.toLowerCase(), p]));

  // Nouveau style (v2) : mêmes offres, mêmes prix, mêmes textes et même comparatif ; seule la mise en forme change.
  return (
    <Shell>
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <div className="text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F]">Tarifs</p>
          <h1 className="font-display text-[38px] sm:text-[54px] leading-[1.06] tracking-[-0.02em] mt-3">{liaisons("Une offre pour chaque ambition")}</h1>
          <p className="text-[19px] leading-relaxed text-[#4A3A50] mt-5 max-w-2xl mx-auto">
            {pick("Pendant la bêta fermée, l'accès est offert aux testeurs invités, sans carte bancaire. Tarifs prévus à l'ouverture publique.", "14 jours d'essai gratuit sur tous les plans, sans carte bancaire. Sans engagement, résiliable à tout moment.")}
          </p>
          <p className="text-[15px] leading-relaxed text-[#6B5A70] mt-3 max-w-2xl mx-auto">
            Les offres se distinguent par le volume de posts et de sources que vous pouvez déposer, et par les outils autour : campagnes, veille, pages entreprise, équipe.
          </p>
        </div>

        {/* Cartes d'offres avec bascule mensuel / annuel */}
        <PricingCards
          variant="v2"
          plans={PLAN_IDS.map((id) => {
            const plan = PLANS[id];
            const card = cardByName[id] || {};
            return {
              id,
              name: card.name || plan.name,
              price: card.price ?? plan.price,
              desc: card.desc || "",
              highlight: card.highlight ?? id === "pro",
            };
          })}
        />

        {/* Comparatif détaillé */}
        <div className="mt-20">
          <h2 className="font-display text-[30px] sm:text-[40px] tracking-[-0.015em] text-center">{liaisons("Comparer les offres en détail")}</h2>
          <div className="mt-8 bg-white rounded-[28px] border border-[#EFE4E0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#EFE4E0] bg-[#F6E3E0]">
                    <th className="text-left p-4 font-semibold text-[#4A3A50]">Fonctionnalité</th>
                    {PLAN_IDS.map((id) => (
                      <th key={id} className="p-4 text-center">
                        <span className={`font-bold ${id === "pro" ? "text-[#9E3157]" : "text-[#2E1F33]"}`}>{PLANS[id].name}</span>
                        <span className="block text-xs text-[#6B5A70] font-normal">{PLANS[id].price} €/mois</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1E8E4]">
                  {COMPARE.map((row) => (
                    <tr key={row.label}>
                      <td className="p-4 text-[#2E1F33]">{row.label}</td>
                      {PLAN_IDS.map((id) => (
                        <td key={id} className="p-4 text-center text-[#2E1F33]">
                          <Cell v={row.value(PLANS[id])} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-[#6B5A70] text-center mt-4">
            * « Illimité » s'entend dans le cadre d'un usage individuel raisonnable.
          </p>
        </div>

        {/* CTA contact en bas */}
        <div className="mt-16 rounded-[32px] bg-[#F6E3E0] px-6 sm:px-12 py-10 sm:py-12 flex flex-wrap items-center justify-between gap-6">
          <div className="flex-[1_1_380px] min-w-0">
            <h2 className="font-display text-[28px] sm:text-[34px] leading-[1.12]">{liaisons("Une question sur l'offre qu'il vous faut ?")}</h2>
            <p className="text-[17px] leading-relaxed text-[#4A3A50] mt-3">Parlons de votre cas. {pick("On vous aide à choisir — ou demandez une invitation à la bêta.", "On vous aide à choisir — ou démarrez l'essai gratuit dès maintenant.")}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/contact" className="inline-flex items-center justify-center bg-[#C2456F] hover:bg-[#9E3157] text-white font-semibold px-7 py-3.5 rounded-full transition-colors">
              Nous contacter
            </Link>
            <Link href={JOIN_HREF} className="inline-flex items-center justify-center gap-2 border-[1.5px] border-[#C2456F] text-[#9E3157] hover:bg-white font-semibold px-7 py-3 rounded-full transition-colors">
              {pick("Rejoindre la bêta", "Démarrer l'essai gratuit")} <ChevronRight size={17} />
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}
