import { prisma } from "./db";
import { quotaMail, onboardingMail, digestSoloMail, digestAgencyMail, reminderMail, reportMail, digestMailFor, ensureReportLink, pendingPosts } from "./engagementEmails";
import { accountFacts } from "./accountFacts";
import { templates } from "./lifecycleEmails";
import { quotaStatus, QUOTA_KEYS } from "./quotas";
import { getMonthlyReport } from "./reports/monthly";

// Messages d'exemple pour l'administration : chacun est construit par le même code que l'envoi réel, avec des chiffres fictifs.
// Les liens de validation et de rapport sont des exemples (ils ne mènent à aucun client).
const SAMPLE_ALL = (n, limit) => [{ key: "postsPerMonth", n, limit }, { key: "imagesPerMonth", n: 18, limit: 50 }, { key: "knowledgeSources", n: 4, limit: null }];
const SAMPLE_TOKEN = "0".repeat(48);

export const EMAIL_TESTS = [
  { id: "quota80", group: "Quotas", label: "Alerte de quota à 80 %", build: (u) => quotaMail(u, { n: 12, limit: 15, key: "postsPerMonth", level: 80, all: SAMPLE_ALL(12, 15) }) },
  { id: "quota100", group: "Quotas", label: "Quota atteint (100 %)", build: (u) => quotaMail(u, { n: 15, limit: 15, key: "postsPerMonth", level: 100, all: SAMPLE_ALL(15, 15) }) },
  { id: "quotaClient", group: "Quotas", label: "Quota d'un client (pour l'agence)", build: (u) => quotaMail(u, { who: "Wharf", n: 20, limit: 20, key: "postsPerMonth", level: 100, isClient: true, all: SAMPLE_ALL(20, 20) }) },
  { id: "onb1a", group: "Accueil", label: "Jour 1 : LinkedIn non connecté", build: (u) => onboardingMail(u, "d1", { connected: false }) },
  { id: "onb1b", group: "Accueil", label: "Jour 1 : LinkedIn connecté", build: (u) => onboardingMail(u, "d1", { connected: true }) },
  { id: "onb3a", group: "Accueil", label: "Jour 3 : aucun post créé", build: (u) => onboardingMail(u, "d3", { drafts: 0 }) },
  { id: "onb3b", group: "Accueil", label: "Jour 3 : déjà des posts", build: (u) => onboardingMail(u, "d3", { drafts: 4 }) },
  { id: "onb7", group: "Accueil", label: "Jour 7 : pour aller plus loin", build: (u) => onboardingMail(u, "d7", { trialLeft: 7 }) },
  { id: "digestSolo", group: "Récapitulatif du lundi", label: "Utilisateur seul", build: (u) => digestSoloMail(u, { published: 3, scheduled: 2, toValidate: 1, items: { published: [{ excerpt: "Pourquoi nous avons arrêté les réunions du lundi", impressions: 1240 }], next: [{ excerpt: "Notre retour d'expérience sur le télétravail", at: new Date(Date.now() + 2 * 86400000) }], pending: [{ excerpt: "Trois conseils pour votre premier recrutement" }] } }) },
  { id: "digestAgency", group: "Récapitulatif du lundi", label: "Agence (par client)", build: (u) => digestAgencyMail(u, [{ name: "Wharf", published: 3, scheduled: 2, toValidate: 1, changes: 1 }, { name: "Hermès Conseil", published: 1, scheduled: 4, toValidate: 0, changes: 0 }]) },
  { id: "reminder", group: "Envoyés aux clients de l'agence", label: "Relance de validation", build: () => reminderMail({ agency: "Votre agence", client: "Wharf", count: 2, token: SAMPLE_TOKEN, posts: [{ excerpt: "Trois idées reçues sur la logistique du dernier kilomètre…", scheduledAt: new Date(Date.now() + 2 * 86400000), waitingDays: 3 }, { excerpt: "Retour sur notre salon de septembre", scheduledAt: null, waitingDays: 1 }] }) },
  { id: "report", group: "Envoyés aux clients de l'agence", label: "Rapport du mois", build: () => reportMail({ agency: "Votre agence", client: "Wharf", month: "septembre 2026", token: SAMPLE_TOKEN, report: { postsPublished: 6, postsWithStats: 6, totalImpressions: 4210, totalEngagements: 188, avgEngagementRate: 188 / 4210, clientApproved: 4, topPosts: [{ excerpt: "Trois idées reçues sur la logistique", impressions: 1620, engagementRate: 0.058 }, { excerpt: "Notre équipe au salon", impressions: 980, engagementRate: 0.047 }] } }) },
  { id: "welcome", group: "Compte et abonnement", label: "Bienvenue", build: (u) => templates.welcome(u) },
  { id: "trial", group: "Compte et abonnement", label: "Fin d'essai (3 jours)", build: (u) => templates.trial_ending(u, 3) },
  { id: "payment", group: "Compte et abonnement", label: "Paiement échoué", build: (u) => templates.payment_failed(u) },
];

// ── Messages construits avec les données réelles d'un compte (quotas calculés, vrais liens) ─────────────
// Toujours envoyés à l'administrateur seulement. Retourne { mail, note } ou { error }.
export const LIVE_TESTS = [
  { id: "live:quota", group: "Avec un compte réel", label: "Alerte de quota (calcul réel)", needs: "tout compte" },
  { id: "live:onboarding", group: "Avec un compte réel", label: "Accueil (étape selon l'ancienneté du compte)", needs: "tout compte" },
  { id: "live:digest", group: "Avec un compte réel", label: "Récapitulatif de la semaine (chiffres réels)", needs: "tout compte" },
  { id: "live:welcome", group: "Avec un compte réel", label: "Bienvenue (offre et usage réels)", needs: "tout compte" },
  { id: "live:trial", group: "Avec un compte réel", label: "Fin d'essai (jours restants réels)", needs: "tout compte" },
  { id: "live:payment", group: "Avec un compte réel", label: "Paiement échoué (offre et usage réels)", needs: "tout compte" },
  { id: "live:reminder", group: "Avec un compte réel", label: "Relance de validation (client avec lien)", needs: "un client d'agence" },
  { id: "live:report", group: "Avec un compte réel", label: "Rapport du mois précédent (client)", needs: "un client d'agence" },
];

const pct = (n, l) => Math.round((n / l) * 100);

export async function buildLiveTest(id, target, admin) {
  const u = await prisma.user.findUnique({
    where: { id: target },
    select: { id: true, email: true, name: true, companyName: true, plan: true, agencyId: true, createdAt: true, trialEndsAt: true, agency: { select: { name: true } }, agencyMembership: { select: { agencyId: true, role: true } }, linkedin: { select: { personToken: true, orgToken: true } }, _count: { select: { drafts: true } } },
  });
  if (!u) return { error: "Compte introuvable." };
  // Le message s'adresse à l'administrateur : on le salue, pas le compte observé
  const to = { id: admin.id, name: admin.name, email: admin.email };

  if (id === "live:quota") {
    const { limits, usage } = await quotaStatus(u.id);
    const all = QUOTA_KEYS.map((k) => ({ key: k, n: usage[k], limit: limits[k] }));
    const rows = all.filter((r) => r.limit > 0).map((r) => ({ k: r.key, n: r.n, limit: r.limit })).sort((a, b) => b.n / b.limit - a.n / a.limit);
    if (!rows.length) return { error: "Ce compte n'a aucune limite chiffrée (offre illimitée)." };
    const { k, n, limit } = rows[0];
    const level = n >= limit ? 100 : n >= limit * 0.8 ? 80 : 0;
    const isClient = Boolean(u.agencyId);
    const mail = quotaMail(to, { who: isClient ? u.companyName || u.name : null, n, limit, key: k, level: level || 80, isClient, all });
    const summary = rows.map((r) => `${r.k} ${r.n}/${r.limit} (${pct(r.n, r.limit)} %)`).join(", ");
    return { mail, note: level ? `Alerte réelle : ${summary}.` : `Ce compte est sous 80 % (${summary}) : aucune alerte réelle ne partirait, le message montre la mise en forme avec ses vrais chiffres.` };
  }
  if (id === "live:onboarding") {
    const age = (Date.now() - new Date(u.createdAt).getTime()) / 86400000;
    const step = age >= 7 ? "d7" : age >= 3 ? "d3" : "d1";
    const trialLeft = u.trialEndsAt ? Math.max(0, Math.ceil((new Date(u.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;
    return { mail: onboardingMail(to, step, { connected: Boolean(u.linkedin?.personToken || u.linkedin?.orgToken), drafts: u._count.drafts, trialLeft, facts: await accountFacts(u.id) }), note: `Étape ${step} (compte créé il y a ${Math.floor(age)} j).` };
  }
  if (id === "live:digest") {
    const mail = await digestMailFor({ id: u.id, email: admin.email, name: admin.name, agencyMembership: u.agencyMembership });
    if (!mail) return { error: "Aucune activité cette semaine pour ce compte : le récapitulatif réel ne serait pas envoyé." };
    return { mail, note: "Chiffres des 7 derniers jours de ce compte." };
  }
  if (id === "live:welcome" || id === "live:trial" || id === "live:payment") {
    const facts = await accountFacts(u.id);
    if (id === "live:welcome") return { mail: templates.welcome(to, facts), note: `Offre ${facts.planName}.` };
    if (id === "live:payment") return { mail: templates.payment_failed(to, facts), note: `Offre ${facts.planName}.` };
    const days = facts.trialLeft;
    return { mail: templates.trial_ending(to, days || 3, facts), note: days ? `Essai : ${days} jour(s) restant(s).` : "Ce compte n'a pas d'essai en cours : le message montre 3 jours, comme l'envoi réel à J-3." };
  }
  if (!u.agencyId) return { error: "Choisissez un client d'agence pour ce message." };
  const agency = u.agency?.name || "Votre agence";
  const client = u.companyName || u.name;
  if (id === "live:reminder") {
    const link = await prisma.approvalLink.findUnique({ where: { userId: u.id } });
    if (!link) return { error: "Ce client n'a pas encore de lien de validation (Clients → Valider avec le client)." };
    const pending = await prisma.draft.findMany({ where: { userId: u.id, status: "à valider", clientFeedback: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true, text: true, scheduledAt: true } });
    const count = pending.length;
    if (!count) return { error: "Aucun post de ce client n'attend sa validation : la relance réelle ne serait pas envoyée." };
    return { mail: reminderMail({ agency, client, count, token: link.token, posts: pendingPosts(pending) }), note: `${count} post(s) en attente ; le lien ouvre la vraie page de validation.` };
  }
  if (id === "live:report") {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const report = await getMonthlyReport(u.id, { year: prev.getFullYear(), month: prev.getMonth() + 1 });
    const rl = await ensureReportLink(u.id, u.agencyId);
    const month = prev.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return { mail: reportMail({ agency, client, month, report, token: rl.token }), note: `Rapport de ${month} : ${report.postsPublished} post(s) publié(s) ; le lien ouvre le vrai rapport.` };
  }
  return { error: "Message inconnu." };
}
