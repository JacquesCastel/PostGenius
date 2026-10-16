import { prisma } from "./db";
import { getMonthlyReport } from "./reports/monthly";

// Prévisualisation des rapports mensuels envoyés aux clients d'agence (administration).
// Reprend les règles de runMonthlyClientReports (lib/engagementEmails.js) pour dire, client par client, ce qui partira le 1er du mois
// et pourquoi certains ne recevront rien. Aucun e-mail n'est envoyé ici.

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Les rapports partent du 1er au 3 (dès 8 h) pour le MOIS PRÉCÉDENT. Du 1er au 3 : on regarde ce mois précédent (envoi en cours ou fait) ;
// ensuite : le mois en cours, dont le rapport partira le 1er du mois suivant.
export function reportPeriod(now = new Date()) {
  const inWindow = now.getDate() <= 3;
  const start = inWindow ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    year: start.getFullYear(),
    month: start.getMonth() + 1,
    key: monthKey(start),
    label: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    inWindow,
    sendOn: inWindow ? null : new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

// Verdict d'un client : "partira" | "partira-sans-stats" | "ne-partira-pas" | "deja-fait"
export function reportVerdict({ link, report, key, inWindow }) {
  const reasons = [];
  if (!link) return { status: "ne-partira-pas", reasons: ["Aucun lien de validation : le client n'a jamais été contacté par l'agence."] };
  if (!link.sentTo) reasons.push("Aucune adresse e-mail : le lien de validation n'a jamais été envoyé au client.");
  if (!link.autoReport) reasons.push("Rapport mensuel désactivé pour ce client.");
  if (reasons.length) return { status: "ne-partira-pas", reasons };
  if (inWindow && link.lastReportKey === key) return { status: "deja-fait", reasons: ["Déjà traité ce mois-ci (envoyé, ou ignoré faute de post publié)."] };
  if (!report.postsPublished) {
    return { status: "ne-partira-pas", reasons: [inWindow ? "Aucun post publié le mois dernier : rien ne part." : "Aucun post publié ce mois-ci pour l'instant : à ce jour, rien ne partirait."] };
  }
  if (!report.postsWithStats) return { status: "partira-sans-stats", reasons: ["Aucune statistique LinkedIn : le rapport indiquera seulement le nombre de posts, sans impressions ni engagement."] };
  if (report.postsWithStats < report.postsPublished) return { status: "partira", reasons: [`Statistiques disponibles pour ${report.postsWithStats} post${report.postsWithStats > 1 ? "s" : ""} sur ${report.postsPublished}.`] };
  return { status: "partira", reasons: [] };
}

export async function previewMonthlyReports({ now = new Date() } = {}) {
  const period = reportPeriod(now);
  const clients = await prisma.user.findMany({
    where: { agencyId: { not: null }, disabled: false },
    select: { id: true, name: true, companyName: true, agency: { select: { name: true } }, approvalLink: { select: { sentTo: true, autoReport: true, lastReportKey: true } } },
    orderBy: [{ agencyId: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
  const rows = [];
  for (const c of clients) {
    const report = await getMonthlyReport(c.id, { year: period.year, month: period.month });
    const v = reportVerdict({ link: c.approvalLink, report, key: period.key, inWindow: period.inWindow });
    rows.push({
      id: c.id,
      agency: c.agency?.name ?? "",
      client: c.companyName || c.name,
      to: c.approvalLink?.sentTo ?? null,
      posts: report.postsPublished,
      withStats: report.postsWithStats,
      impressions: report.postsWithStats ? report.totalImpressions : null,
      status: v.status,
      reasons: v.reasons,
    });
  }
  // Ce qui demande de l'attention d'abord : rapports sans statistiques, puis ceux qui partiront, puis les déjà traités, puis ceux qui ne partiront pas
  const RANK = { "partira-sans-stats": 0, partira: 1, "deja-fait": 2, "ne-partira-pas": 3 };
  rows.sort((a, b) => RANK[a.status] - RANK[b.status]);
  const count = (s) => rows.filter((r) => r.status === s).length;
  return {
    period: { label: period.label, key: period.key, inWindow: period.inWindow, sendOn: period.sendOn },
    summary: { partira: count("partira"), partiraSansStats: count("partira-sans-stats"), nePartiraPas: count("ne-partira-pas"), dejaFait: count("deja-fait"), total: rows.length },
    rows,
  };
}
