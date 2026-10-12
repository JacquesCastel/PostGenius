// Corps du rapport mensuel d'un client d'agence : partagé entre la fenêtre de l'agence et la page de partage (/rapport/…).
const pct = (n) => (n == null ? "—" : `${(n * 100).toFixed(1)} %`);

export default function MonthlyReportBody({ report, primary = "#1b2a4a", accent = "#ff5a5f" }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Posts publiés", value: report.postsPublished },
          { label: "Impressions", value: report.totalImpressions.toLocaleString("fr-FR") },
          { label: "Engagement moyen", value: pct(report.avgEngagementRate) },
          { label: "Validés par le client", value: report.clientApproved ?? 0 },
          { label: "Recos suivies", value: `${report.recommendations.followed}/${report.recommendations.proposed || 0}` },
        ].map((k) => (
          <div key={k.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-lg font-bold" style={{ color: primary }}>{k.value}</p>
            <p className="text-[11px] text-gray-400">{k.label}</p>
          </div>
        ))}
      </div>

      {report.topPosts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Meilleurs posts</p>
          <div className="space-y-2">
            {report.topPosts.map((p) => (
              <div key={p.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-700 truncate">{p.theme}</p>
                  <span className="text-xs font-semibold shrink-0" style={{ color: accent }}>{pct(p.engagementRate)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.excerpt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Tous les posts publiés ce mois ({report.posts.length})
        </p>
        {report.posts.length === 0 ? (
          <p className="text-xs text-gray-300">Aucun post publié sur ce mois.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto print:max-h-none print:overflow-visible">
            {report.posts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 text-xs border-b border-gray-50 py-1.5">
                <span className="text-gray-400 shrink-0">
                  {new Date(p.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </span>
                <span className="text-gray-600 truncate flex-1">{p.theme}</span>
                <span className="text-gray-400 shrink-0">
                  {p.impressions != null ? `${pct(p.engagementRate)} · ${p.impressions.toLocaleString("fr-FR")} imp.` : "stats à venir"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {report.postsPublished > report.postsWithStats && (
        <p className="text-[11px] text-gray-300">
          {report.postsPublished - report.postsWithStats} post(s) sans statistiques pour l&apos;instant (mesurées à J+1 et J+7 après publication).
        </p>
      )}
    </div>
  );
}
