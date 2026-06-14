import Link from "next/link";
import { Check, Minus, ChevronRight } from "lucide-react";
import { getLanding } from "@/lib/landing";
import { PLANS, PLAN_IDS } from "@/lib/plans";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tarifs — LinkeePost",
  description:
    "Trois offres simples pour piloter votre présence LinkedIn : Essentiel, Pro et Agence. 14 jours d'essai gratuit, sans carte bancaire.",
};

// Lignes du comparatif. value(plan) → true (inclus) | false (non) | "texte"/nombre
const COMPARE = [
  { label: "Posts générés par mois", value: (p) => (p.postsPerMonth == null ? "Illimité" : `${p.postsPerMonth}`) },
  { label: "Images IA par mois", value: (p) => (p.imagesPerMonth == null ? "Illimité" : p.imagesPerMonth === 0 ? false : `${p.imagesPerMonth}`) },
  { label: "Profil de rédaction (style, contexte)", value: () => true },
  { label: "Publication sur profil personnel", value: () => true },
  { label: "Programmation & pilote automatique", value: () => true },
  { label: "Campagnes guidées par l'IA", value: (p) => p.campaigns },
  { label: "Veille connectée & inspirations", value: (p) => p.veille },
  { label: "Validation avant publication", value: (p) => p.campaigns },
  { label: "Statistiques détaillées", value: (p) => p.campaigns },
  { label: "Publication sur page entreprise", value: (p) => p.orgPublish },
  { label: "Statistiques de page (impressions…)", value: (p) => p.orgStats },
  { label: "Module Événements (salons, forums)", value: (p) => p.events },
  { label: "Support prioritaire", value: (p) => p.id === "agence" },
];

function Cell({ v }) {
  if (v === true) return <Check size={18} className="text-[#ff5a5f] mx-auto" />;
  if (v === false) return <Minus size={16} className="text-gray-300 mx-auto" />;
  return <span className="font-semibold">{v}</span>;
}

export default async function TarifsPage() {
  const { plans } = await getLanding();
  // Prix/textes éditables (getLanding) indexés par id de plan
  const cardByName = Object.fromEntries(plans.map((p) => [p.name.toLowerCase(), p]));

  return (
    <div className="relative overflow-hidden text-[#1b2a4a] bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50 min-h-screen">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-48 -right-24 w-[24rem] h-[24rem] rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative">
        <SiteHeader />

        <main className="max-w-6xl mx-auto px-6 py-14">
          <div className="text-center">
            <p className="text-sm font-semibold text-[#ff5a5f]">Tarifs</p>
            <h1 className="text-4xl md:text-5xl font-extrabold mt-2">Une offre pour chaque ambition</h1>
            <p className="text-[#5a6b85] mt-3 max-w-2xl mx-auto">
              14 jours d'essai gratuit sur tous les plans, sans carte bancaire. Sans engagement, résiliable à tout moment.
            </p>
          </div>

          {/* Cartes d'offres */}
          <div className="grid md:grid-cols-3 gap-6 mt-12 items-start">
            {PLAN_IDS.map((id) => {
              const plan = PLANS[id];
              const card = cardByName[id] || { name: plan.name, price: plan.price, desc: "", features: [], highlight: id === "pro" };
              return (
                <div
                  key={id}
                  className={`bg-white rounded-3xl p-7 relative ${
                    card.highlight ? "ring-2 ring-[#ff5a5f] shadow-2xl shadow-rose-200/50 md:-translate-y-2" : "border border-white shadow-lg shadow-rose-100/30"
                  }`}
                >
                  {card.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ff5a5f] text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                      Le plus choisi
                    </span>
                  )}
                  <h3 className="font-bold text-lg">{card.name}</h3>
                  {card.desc && <p className="text-sm text-[#5a6b85] mt-1 min-h-10">{card.desc}</p>}
                  <p className="mt-4">
                    <span className="text-4xl font-extrabold">{card.price} €</span>
                    <span className="text-gray-400 text-sm"> /mois HT</span>
                  </p>
                  <Link
                    href={`/app?plan=${id}`}
                    className={`mt-6 block text-center font-semibold px-4 py-3 rounded-full transition-colors ${
                      card.highlight
                        ? "bg-[#ff5a5f] hover:bg-[#f63d44] text-white shadow-lg shadow-rose-300/40"
                        : "border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a]"
                    }`}
                  >
                    Commencer l'essai
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Comparatif détaillé */}
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl font-extrabold text-center">Comparer les offres en détail</h2>
            <div className="mt-8 bg-white rounded-3xl border border-white shadow-lg shadow-rose-100/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-rose-100">
                      <th className="text-left p-4 font-medium text-[#5a6b85]">Fonctionnalité</th>
                      {PLAN_IDS.map((id) => (
                        <th key={id} className="p-4 text-center">
                          <span className={`font-bold ${id === "pro" ? "text-[#ff5a5f]" : "text-[#1b2a4a]"}`}>{PLANS[id].name}</span>
                          <span className="block text-xs text-gray-400 font-normal">{PLANS[id].price} €/mois</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50">
                    {COMPARE.map((row) => (
                      <tr key={row.label}>
                        <td className="p-4 text-[#1b2a4a]">{row.label}</td>
                        {PLAN_IDS.map((id) => (
                          <td key={id} className="p-4 text-center text-[#1b2a4a]">
                            <Cell v={row.value(PLANS[id])} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              * « Illimité » s'entend dans le cadre d'un usage individuel raisonnable.
            </p>
          </div>

          {/* CTA contact en bas */}
          <div className="mt-16 rounded-[2.5rem] bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white text-center p-12 shadow-2xl shadow-rose-300/50 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
            <h2 className="text-3xl font-extrabold">Une question sur l'offre qu'il vous faut ?</h2>
            <p className="text-white/85 mt-3">Parlons de votre cas. On vous aide à choisir — ou démarrez l'essai gratuit dès maintenant.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
              <Link href="/contact" className="inline-flex items-center gap-2 bg-white text-[#ff5a5f] font-bold px-7 py-3.5 rounded-full hover:bg-rose-50 transition-colors">
                Nous contacter
              </Link>
              <Link href="/app" className="inline-flex items-center gap-2 bg-white/15 border border-white/40 text-white font-semibold px-7 py-3.5 rounded-full hover:bg-white/25 transition-colors">
                Démarrer l'essai gratuit <ChevronRight size={17} />
              </Link>
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
