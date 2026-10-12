"use client";

import { useState, useEffect, use } from "react";
import { RefreshCw, AlertCircle, ChevronDown, Printer } from "lucide-react";
import MonthlyReportBody from "@/components/MonthlyReportBody";

// Rapport mensuel partagé par l'agence à son client : lecture seule, aux couleurs de l'agence, exportable en PDF (impression du navigateur).
export default function SharedReport({ params }) {
  const { token } = use(params);
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rapport/${token}?year=${period.year}&month=${period.month}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Erreur");
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, period]);

  const change = (delta) => {
    const d = new Date(period.year, period.month - 1 + delta, 1);
    setPeriod({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };
  const isCurrent = period.year === now.getFullYear() && period.month === now.getMonth() + 1;
  const label = new Date(period.year, period.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const primary = data?.brand.primaryColor || "#1b2a4a";

  return (
    <div className="min-h-screen p-4 sm:p-6 print:p-0">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border-0 print:max-w-full">
        {error && !data ? (
          <p className="text-sm text-red-600 flex items-center gap-2"><AlertCircle size={16} /> {error}</p>
        ) : !data ? (
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2 py-10"><RefreshCw size={16} className="animate-spin" /> Chargement…</p>
        ) : (
          <>
            <div className="h-1 -mx-6 -mt-6 mb-4 rounded-t-xl print:hidden" style={{ backgroundColor: primary }} />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                {data.brand.logoUrl && <img src={data.brand.logoUrl} alt="" className="h-8 max-w-[160px] object-contain mb-2" />}
                <h1 className="text-lg font-bold" style={{ color: primary }} data-testid="shared-report-client">{data.client}</h1>
                <p className="text-sm text-gray-500">Rapport mensuel{data.agency ? ` · ${data.agency}` : ""}</p>
                {data.brand.tagline && <p className="text-xs text-gray-400 mt-0.5">{data.brand.tagline}</p>}
              </div>
              <button type="button" onClick={() => window.print()} className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 print:hidden" data-testid="shared-report-print">
                <Printer size={13} /> Enregistrer en PDF
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <button type="button" onClick={() => change(-1)} disabled={loading} className="p-1 hover:bg-gray-100 rounded print:hidden" aria-label="Mois précédent"><ChevronDown size={14} className="rotate-90" /></button>
              <span className="capitalize font-medium" data-testid="shared-report-month">{label}</span>
              <button type="button" onClick={() => change(1)} disabled={loading || isCurrent} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 print:hidden" aria-label="Mois suivant"><ChevronDown size={14} className="-rotate-90" /></button>
              {loading && <RefreshCw size={13} className="animate-spin text-gray-300 print:hidden" />}
            </div>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <MonthlyReportBody report={data.report} primary={primary} accent={data.brand.accentColor} />
          </>
        )}
      </div>
    </div>
  );
}
