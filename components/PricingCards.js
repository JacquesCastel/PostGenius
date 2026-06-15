"use client";
import { useState } from "react";
import Link from "next/link";

// Cartes d'offres avec bascule mensuel / annuel (page tarifs publique).
// plans : [{ id, name, price (nombre, mensuel HT), desc, highlight }]
export default function PricingCards({ plans }) {
  const [period, setPeriod] = useState("month");

  return (
    <>
      {/* Bascule */}
      <div className="flex items-center justify-center mt-10">
        <div className="bg-white shadow-sm border border-rose-100 p-1 rounded-full flex">
          <button
            onClick={() => setPeriod("month")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${period === "month" ? "bg-[#ff5a5f] text-white" : "text-[#5a6b85]"}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setPeriod("year")}
            className={`px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-colors ${period === "year" ? "bg-[#ff5a5f] text-white" : "text-[#5a6b85]"}`}
          >
            Annuel
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${period === "year" ? "bg-white/25 text-white" : "bg-[#fff1f1] text-[#ff5a5f]"}`}>
              2 mois offerts
            </span>
          </button>
        </div>
      </div>

      {/* Cartes */}
      <div className="grid md:grid-cols-3 gap-6 mt-10 items-start">
        {plans.map((card) => {
          const monthly = Number(card.price);
          const yearly = monthly * 10;
          const price = period === "year" ? yearly : monthly;
          return (
            <div
              key={card.id}
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
                <span className="text-4xl font-extrabold">{price} €</span>
                <span className="text-gray-400 text-sm"> /{period === "year" ? "an" : "mois"} HT</span>
              </p>
              <p className="text-xs text-[#ff5a5f] font-medium mt-1 min-h-4">
                {period === "year" ? `soit ${(yearly / 12).toFixed(2)} €/mois` : ""}
              </p>
              <Link
                href={`/app?plan=${card.id}`}
                className={`mt-5 block text-center font-semibold px-4 py-3 rounded-full transition-colors ${
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
      <p className="text-xs text-gray-400 text-center mt-5">
        14 jours d'essai gratuit, sans carte bancaire. Le paiement (mensuel ou annuel) n'est demandé qu'à la fin de l'essai.
      </p>
    </>
  );
}
