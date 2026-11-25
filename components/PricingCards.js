"use client";
import { useState } from "react";
import Link from "next/link";
import { yearlyPrice, ANNUAL_OFFER } from "@/lib/plans";
import { BETA, pick } from "@/lib/access";

const STYLE_V1 = {
  toggle: "bg-white shadow-sm border border-rose-100 p-1 rounded-full flex",
  on: "bg-[#ff5a5f] text-white", off: "text-[#5a6b85]", chipOn: "bg-white/25 text-white", chipOff: "bg-[#fff1f1] text-[#ff5a5f]",
  cardHi: "ring-2 ring-[#ff5a5f] shadow-2xl shadow-rose-200/50 md:-translate-y-2", card: "border border-white shadow-lg shadow-rose-100/30", cardBase: "bg-white rounded-3xl p-7 relative",
  badge: "absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ff5a5f] text-white text-xs font-semibold px-3 py-1 rounded-full shadow",
  desc: "text-sm text-[#5a6b85] mt-1 min-h-10", unit: "text-gray-400 text-sm", year: "text-xs text-[#ff5a5f] font-medium mt-1 min-h-4",
  ctaHi: "bg-[#ff5a5f] hover:bg-[#f63d44] text-white shadow-lg shadow-rose-300/40", cta: "border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a]", note: "text-xs text-gray-400 text-center mt-5",
};
const STYLE_V2 = {
  toggle: "bg-white border border-[#EFE4E0] p-1 rounded-full flex",
  on: "bg-[#C2456F] text-white", off: "text-[#4A3A50]", chipOn: "bg-white/25 text-white", chipOff: "bg-[#F6E3E0] text-[#7A2342]",
  cardHi: "border-2 border-[#C2456F] shadow-[0_18px_40px_rgba(46,31,51,0.10)]", card: "border border-[#EFE4E0]", cardBase: "bg-white rounded-[28px] p-8 relative",
  badge: "absolute -top-3 left-8 bg-[#C2456F] text-white text-xs font-semibold px-3 py-1 rounded-full",
  desc: "text-[15px] text-[#4A3A50] mt-1.5 min-h-10 leading-relaxed", unit: "text-[#6B5A70] text-sm", year: "text-xs text-[#9E3157] font-medium mt-1 min-h-4",
  ctaHi: "bg-[#C2456F] hover:bg-[#9E3157] text-white", cta: "border-[1.5px] border-[#C2456F] text-[#9E3157] hover:bg-[#F6E3E0]", note: "text-[13px] text-[#6B5A70] text-center mt-5",
};

// Cartes d'offres avec bascule mensuel / annuel (page tarifs publique).
// plans : [{ id, name, price (nombre, mensuel HT), desc, highlight }]
export default function PricingCards({ plans, variant = "v1" }) {
  const [period, setPeriod] = useState("month");
  const v2 = variant === "v2"; // nouveau style : même contenu et même logique, autres classes
  const S = v2 ? STYLE_V2 : STYLE_V1;

  return (
    <>
      {/* Bascule */}
      <div className="flex items-center justify-center mt-10">
        <div className={S.toggle}>
          <button
            onClick={() => setPeriod("month")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${period === "month" ? S.on : S.off}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setPeriod("year")}
            className={`px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-colors ${period === "year" ? S.on : S.off}`}
          >
            Annuel
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${period === "year" ? S.chipOn : S.chipOff}`}>
              {ANNUAL_OFFER}
            </span>
          </button>
        </div>
      </div>

      {/* Cartes */}
      <div className="grid md:grid-cols-3 gap-6 mt-10 items-start">
        {plans.map((card) => {
          const monthly = Number(card.price);
          const yearly = yearlyPrice(monthly);
          const price = period === "year" ? yearly : monthly;
          return (
            <div
              key={card.id}
              className={`${S.cardBase} ${card.highlight ? S.cardHi : S.card}`}
            >
              {card.highlight && (
                <span className={S.badge}>
                  Le plus choisi
                </span>
              )}
              <h3 className="font-bold text-lg">{card.name}</h3>
              {card.desc && <p className={S.desc}>{card.desc}</p>}
              <p className="mt-4">
                <span className="text-4xl font-extrabold">{price} €</span>
                <span className={S.unit}> /{period === "year" ? "an" : "mois"} HT</span>
              </p>
              <p className={S.year}>
                {period === "year" ? `soit ${(yearly / 12).toFixed(2)} €/mois` : ""}
              </p>
              <Link
                href={BETA ? "/beta" : `/app?plan=${card.id}`}
                className={`mt-5 block text-center font-semibold px-4 py-3 rounded-full transition-colors ${
                  card.highlight ? S.ctaHi : S.cta
                }`}
              >
                {pick("Demander une invitation", "Commencer l'essai")}
              </Link>
            </div>
          );
        })}
      </div>
      <p className={S.note}>
        {pick("Pendant la bêta fermée, l'accès est offert aux testeurs invités, sans carte bancaire. Tarifs prévus à l'ouverture publique.", "14 jours d'essai gratuit, sans carte bancaire. Le paiement (mensuel ou annuel) n'est demandé qu'à la fin de l'essai.")}
      </p>
    </>
  );
}
