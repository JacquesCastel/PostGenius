import { prisma } from "./db";
import { sendMail, isMailerConfigured } from "./mailer";
import { buildEmail, escHtml } from "./emailLayout";
import { isAdminUser } from "./admin";
import { sendOnce } from "./lifecycleEmails";
import { planLimits, applyOverrides, QUOTA_KEYS } from "./quotas";
import { unsubscribeUrl, clientUnsubscribeUrl } from "./emailPrefs";
import { getMonthlyReport } from "./reports/monthly";
import { accountFacts, factsHtml, excerpt } from "./accountFacts";

// E-mails d'accompagnement envoyés par le planificateur (une passe par heure) :
//   - alertes de quota (80 % puis 100 %), en e-mail de service ;
//   - séquence d'accueil (jours 1, 3 et 7), récapitulatif hebdomadaire du lundi : avec lien de désinscription ;
//   - pour l'agence : relances de validation et rapport du mois envoyés à ses clients (réglage par client, désactivé par défaut).
// Chaque envoi est unique (LifecycleEmail) ; sans SMTP configuré, rien n'est enregistré : les e-mails partiront dès que ce sera le cas.
const DAY = 86400000;
const base = () => (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
const hello = (u) => `Bonjour${u?.name ? ` ${escHtml(u.name)}` : ""},`;
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthStartOf = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const isoWeekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7)).padStart(2, "0")}`;
};
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// ── Constructeurs de messages : les mêmes pour les envois réels et pour les tests de l'administration ──────────────
export function quotaMail(r, { who = null, n, limit, key, level, isClient = false, all = null }) {
  const t = QUOTA_TEXT[key];
  const title = level === 100 ? (who ? `${who} a atteint son quota` : "Vous avez atteint votre quota") : (who ? `${who} approche de son quota` : "Vous approchez de votre quota");
  return buildEmail({
    subject: `LinkeePost — ${title}`,
    eyebrow: "Quota",
    title,
    preheader: `${n} sur ${limit} ${t.many} utilisés.`,
    paragraphs: [
      hello(r),
      `${who ? `<strong>${escHtml(who)}</strong> a` : "Vous avez"} utilisé <strong>${n} sur ${limit}</strong> ${t.what}${level === 100 ? ` : la limite est atteinte, la création est bloquée${t.reset ? " jusqu'au 1er du mois prochain" : ""}` : ` (${Math.round((n / limit) * 100)} %)`}.`,
      ...(all?.length ? [quotaTable(all, key)] : []),
      isClient ? "Vous pouvez relever la limite de ce client dans « Clients », bouton « Quotas »." : "Passez à une offre supérieure pour lever la limite, ou attendez le début du mois pour que les compteurs repartent à zéro.",
    ],
    cta: isClient ? { label: "Ouvrir les clients", url: `${base()}/app?view=clients` } : { label: "Voir mon usage et mon offre", url: `${base()}/app?view=billing` },
  });
}

// Tous les compteurs du compte (posts, images, sources) ; celui qui déclenche l'alerte est en gras
function quotaTable(all, triggerKey) {
  const lines = all.map(({ key, n, limit }) => {
    const label = QUOTA_TEXT[key].label;
    const val = limit == null ? `${n} · illimité` : `${n} sur ${limit} (${Math.min(100, Math.round((n / limit) * 100))} %)`;
    return key === triggerKey ? `<strong>${label} : ${val}</strong>` : `${label} : ${val}`;
  });
  return `Votre usage actuel :<br>${lines.join("<br>")}`;
}

// step : d1 | d3 | d7 ; ctx : { connected, drafts, trialLeft }
export function onboardingMail(u, step, ctx = {}) {
  const { connected = false, drafts = 0, trialLeft = null, facts = null } = ctx;
  let spec;
  if (step === "d1") {
    spec = connected
      ? { subject: "Votre premier post LinkedIn en 2 minutes", title: "Prêt à écrire votre premier post ?", paragraphs: [hello(u), "Votre compte LinkedIn est connecté. Donnez un sujet à LinkeePost : il rédige un post à votre image, que vous relisez avant publication.", "Deux minutes suffisent pour le premier."], cta: { label: "Créer mon premier post", url: `${base()}/app?view=create` } }
      : { subject: "Connectez LinkedIn pour publier en un clic", title: "Connectez votre compte LinkedIn", paragraphs: [hello(u), "Pour que vos posts partent sur LinkedIn, il reste une étape : autoriser LinkeePost à publier à votre place. Aucun mot de passe LinkedIn ne nous est confié, et vous pouvez révoquer l'accès à tout moment.", "Cela prend une minute."], cta: { label: "Connecter LinkedIn", url: `${base()}/app?view=connections` } };
  } else if (step === "d3") {
    spec = drafts === 0
      ? { subject: "Votre premier post vous attend", title: "Un sujet, et c'est parti", paragraphs: [hello(u), "Vous n'avez pas encore créé de post. Pas d'idée ? Le copilote éditorial propose des sujets argumentés à partir de votre activité et de l'actualité de votre secteur.", "Choisissez-en un, relisez le texte, publiez."], cta: { label: "Créer un post", url: `${base()}/app?view=create` } }
      : { subject: "Programmez vos posts et gagnez du temps", title: "Programmez vos prochains posts", paragraphs: [hello(u), "Vous avez déjà commencé : bravo. Pour tenir un rythme régulier sans y penser, programmez vos posts à l'avance, ou lancez une campagne qui prépare une série complète.", "Vous gardez la main : chaque post peut attendre votre validation."], cta: { label: "Voir mes posts", url: `${base()}/app?view=history` } };
  } else {
    spec = { subject: "Une semaine avec LinkeePost : pour aller plus loin", title: "Une semaine déjà", paragraphs: [hello(u), "Quelques fonctions que l'on découvre souvent après la première semaine :", "• <strong>Campagnes</strong> : une série de posts préparée autour d'un thème.<br>• <strong>Bibliothèque</strong> : vos meilleures accroches et conclusions, réutilisables en un clic.<br>• <strong>Copilote IA</strong> : des idées de posts argumentées, qui apprennent de vos choix.", ...(trialLeft ? [`Votre essai gratuit se termine dans ${plural(trialLeft, "jour", "jours")}.`] : [])], cta: { label: "Ouvrir LinkeePost", url: `${base()}/app` } };
  }
  const f = factsHtml(facts);
  if (f) spec = { ...spec, paragraphs: [...spec.paragraphs, f] };
  return buildEmail({ ...spec, eyebrow: "Bienvenue", unsubscribeUrl: unsubscribeUrl(u.id), note: "Vous recevez ce message car vous venez de créer un compte." });
}

// Récapitulatif d'un utilisateur seul : { published, scheduled, toValidate }
const fmtDay = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const list = (title, rows) => (rows?.length ? `<strong>${title}</strong><br>${rows.join("<br>")}` : null);
export function digestSoloMail(u, { published: pub, scheduled, toValidate, items = null }) {
  const subject = pub ? `Votre semaine sur LinkedIn : ${plural(pub, "post publié", "posts publiés")}` : "Votre semaine sur LinkedIn";
  return buildEmail({
    subject: `LinkeePost — ${subject}`, eyebrow: "Récapitulatif de la semaine", title: subject,
    paragraphs: [
      hello(u),
      `Cette semaine : <strong>${plural(pub, "post publié", "posts publiés")}</strong>, <strong>${scheduled} programmé${scheduled > 1 ? "s" : ""}</strong> pour les sept prochains jours${toValidate ? `, et <strong>${plural(toValidate, "post attend", "posts attendent")}</strong> votre validation` : ""}.`,
      ...[
        list("Publiés cette semaine", items?.published.map((x) => `• « ${escHtml(x.excerpt)} »${x.impressions != null ? ` : ${x.impressions.toLocaleString("fr-FR")} impressions` : ""}`)),
        list("À venir", items?.next.map((x) => `• ${fmtDay(x.at)} : « ${escHtml(x.excerpt)} »`)),
        list("En attente de votre validation", items?.pending.map((x) => `• « ${escHtml(x.excerpt)} »`)),
      ].filter(Boolean),
    ],
    cta: { label: "Ouvrir LinkeePost", url: `${base()}/app?view=history` }, unsubscribeUrl: unsubscribeUrl(u.id), note: "Récapitulatif envoyé le lundi.",
  });
}

// Récapitulatif d'un membre d'agence : rows = [{ name, published, scheduled, toValidate, changes }]
export function digestAgencyMail(u, rows) {
  const tot = rows.reduce((a, r) => ({ p: a.p + r.published, v: a.v + r.toValidate, c: a.c + r.changes }), { p: 0, v: 0, c: 0 });
  const subject = `Votre semaine : ${plural(tot.p, "post publié", "posts publiés")}`;
  return buildEmail({
    subject: `LinkeePost — ${subject}`, eyebrow: "Récapitulatif de la semaine", title: subject,
    paragraphs: [
      hello(u),
      `Cette semaine, vos clients ont <strong>${plural(tot.p, "post publié", "posts publiés")}</strong>${tot.v ? `, <strong>${plural(tot.v, "post attend", "posts attendent")}</strong> une validation` : ""}${tot.c ? ` et <strong>${plural(tot.c, "modification demandée", "modifications demandées")}</strong>` : ""}.`,
      rows.map((r) => `<strong>${escHtml(r.name)}</strong> : ${r.published} publié${r.published > 1 ? "s" : ""} · ${r.scheduled} programmé${r.scheduled > 1 ? "s" : ""} · ${r.toValidate} à valider${r.changes ? ` · ${r.changes} modification${r.changes > 1 ? "s" : ""} demandée${r.changes > 1 ? "s" : ""}` : ""}${r.nextAt ? ` · prochain post : ${fmtDay(r.nextAt)}` : ""}${r.impressions ? ` · ${r.impressions.toLocaleString("fr-FR")} impressions` : ""}`).join("<br>"),
    ],
    cta: { label: "Ouvrir LinkeePost", url: `${base()}/app?view=${tot.v || tot.c ? "queue" : "followup"}` }, unsubscribeUrl: unsubscribeUrl(u.id), note: "Récapitulatif envoyé le lundi.",
  });
}

// Posts en attente de validation, pour la liste de la relance
export const pendingPosts = (drafts, now = new Date()) => drafts.map((d) => ({ excerpt: excerpt(d.text), scheduledAt: d.scheduledAt, waitingDays: Math.floor((now.getTime() - new Date(d.createdAt).getTime()) / DAY) }));

export function reminderMail({ agency, client, count, token, posts = [], linkId = null }) {
  return buildEmail({
    subject: `${agency} — ${plural(count, "post attend", "posts attendent")} votre validation`,
    eyebrow: agency,
    title: `${plural(count, "post attend", "posts attendent")} votre validation`,
    preheader: `Relisez et validez en un clic les publications LinkedIn de ${client}.`,
    paragraphs: ["Bonjour,", `<strong>${escHtml(agency)}</strong> a préparé ${plural(count, "publication", "publications")} LinkedIn pour ${escHtml(client)}. Elles attendent votre accord pour partir : relisez-les, validez-les en un clic, ou demandez une modification.`,
      ...(posts.length ? [`<strong>En attente :</strong><br>${posts.slice(0, 5).map((p) => `• « ${escHtml(p.excerpt)} »${p.scheduledAt ? ` (prévu le ${fmtDay(p.scheduledAt)})` : ""}${p.waitingDays ? ` · en attente depuis ${plural(p.waitingDays, "jour", "jours")}` : ""}`).join("<br>")}${posts.length > 5 ? `<br>… et ${posts.length - 5} autre${posts.length - 5 > 1 ? "s" : ""}` : ""}`] : []),
    ],
    cta: { label: "Voir les posts à valider", url: `${base()}/valider/${token}` },
    ...(linkId ? { unsubscribeUrl: clientUnsubscribeUrl(linkId, "reminders") } : {}),
    note: linkId ? "Vous recevez ce rappel de la part de votre agence." : "Pour ne plus recevoir ces rappels, prévenez votre agence.",
  });
}

export function reportMail({ agency, client, month, report, token, linkId = null }) {
  const published = report.postsPublished;
  const imp = report.totalImpressions;
  const rate = report.avgEngagementRate;
  const figures = [
    `Posts publiés : <strong>${published}</strong>`,
    ...(report.postsWithStats ? [`Impressions : <strong>${imp.toLocaleString("fr-FR")}</strong>`, `Interactions (réactions, commentaires, partages) : <strong>${report.totalEngagements.toLocaleString("fr-FR")}</strong>`] : []),
    ...(rate != null ? [`Taux d'engagement moyen : <strong>${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong>`] : []),
    ...(report.clientApproved ? [`Posts validés par vos soins : <strong>${report.clientApproved}</strong>`] : []),
  ];
  const top = report.topPosts?.length
    ? [`<strong>Vos meilleurs posts :</strong><br>${report.topPosts.map((p) => `• « ${escHtml(excerpt(p.excerpt, 80))} » : ${p.impressions.toLocaleString("fr-FR")} impressions${p.engagementRate != null ? `, ${(p.engagementRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % d'engagement` : ""}`).join("<br>")}`]
    : [];
  return buildEmail({
    subject: `${agency} — votre rapport LinkedIn de ${month}`,
    eyebrow: agency,
    title: `Votre rapport de ${month}`,
    preheader: `${plural(published, "post publié", "posts publiés")} pour ${client}.`,
    paragraphs: ["Bonjour,", `Voici le bilan LinkedIn de <strong>${escHtml(client)}</strong> pour ${escHtml(month)}.`, figures.join("<br>"), ...top, "Le rapport complet est disponible en ligne."],
    cta: { label: "Voir le rapport", url: `${base()}/rapport/${token}` },
    ...(linkId ? { unsubscribeUrl: clientUnsubscribeUrl(linkId, "report") } : {}),
    note: linkId ? "Vous recevez ce rapport de la part de votre agence." : "Pour ne plus recevoir ce rapport, prévenez votre agence.",
  });
}

// ── 1. Alertes de quota
const QUOTA_TEXT = {
  postsPerMonth: { one: "post", many: "posts", what: "vos posts du mois", label: "Posts créés ce mois-ci", reset: true },
  imagesPerMonth: { one: "image", many: "images", what: "vos images IA du mois", label: "Images IA ce mois-ci", reset: true },
  knowledgeSources: { one: "source", many: "sources", what: "vos sources de connaissances", label: "Sources de connaissances", reset: false },
};

export async function runQuotaAlerts() {
  const now = new Date();
  const mStart = monthStartOf(now);
  const users = await prisma.user.findMany({
    where: { disabled: false },
    select: { id: true, email: true, name: true, role: true, plan: true, quotaOverrides: true, agencyId: true, companyName: true },
    take: 5000,
  });
  const [posts, images, sources] = await Promise.all([
    prisma.draft.groupBy({ by: ["userId"], where: { createdAt: { gte: mStart } }, _count: { _all: true } }),
    prisma.usageEvent.groupBy({ by: ["userId"], where: { kind: "image", createdAt: { gte: mStart } }, _sum: { images: true } }),
    prisma.knowledgeSource.groupBy({ by: ["userId"], _count: { _all: true } }),
  ]);
  const used = {
    postsPerMonth: new Map(posts.map((r) => [r.userId, r._count._all])),
    imagesPerMonth: new Map(images.map((r) => [r.userId, r._sum.images ?? 0])),
    knowledgeSources: new Map(sources.map((r) => [r.userId, r._count._all])),
  };
  const planCache = new Map();
  const owners = new Map(); // agence → propriétaires
  const ownersOf = async (agencyId) => {
    if (!owners.has(agencyId)) owners.set(agencyId, (await prisma.agencyMember.findMany({ where: { agencyId, role: "owner" }, select: { user: { select: { id: true, email: true, name: true } } } })).map((m) => m.user));
    return owners.get(agencyId);
  };

  let sent = 0;
  for (const u of users) {
    if (isAdminUser(u)) continue;
    if (!planCache.has(u.plan)) planCache.set(u.plan, await planLimits(u.plan));
    const limits = applyOverrides(planCache.get(u.plan), u.quotaOverrides);
    for (const k of QUOTA_KEYS) {
      const limit = limits[k];
      if (limit == null || limit <= 0) continue;
      const n = used[k].get(u.id) ?? 0;
      const level = n >= limit ? 100 : n >= limit * 0.8 ? 80 : 0;
      if (!level) continue;
      // Un client d'agence n'a pas de boîte e-mail réelle : seule une limite fixée par l'agence est signalée, au propriétaire
      const isClient = Boolean(u.agencyId);
      if (isClient && u.quotaOverrides?.[k] === undefined) continue;
      const recipients = isClient ? await ownersOf(u.agencyId) : [u];
      const who = isClient ? u.companyName || u.name : null;
      for (const r of recipients) {
        const mail = quotaMail(r, { who, n, limit, key: k, level, isClient, all: QUOTA_KEYS.map((q) => ({ key: q, n: used[q].get(u.id) ?? 0, limit: limits[q] })) });
        if (await sendOnce(r, `quota:${u.id}:${k}:${level}:${monthKey(now)}`, mail)) sent++;
      }
    }
  }
  return { sent };
}

// ── 2. Séquence d'accueil ─────────────────────────────────────────────────────────────
export async function runOnboardingEmails() {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: { disabled: false, agencyId: null, emailOptOut: false, agencyMembership: null, createdAt: { gte: new Date(now - 10 * DAY), lte: new Date(now - DAY) } },
    select: { id: true, email: true, name: true, role: true, createdAt: true, trialEndsAt: true, linkedin: { select: { personToken: true, orgToken: true } }, _count: { select: { drafts: true } } },
    take: 500,
  });
  let sent = 0;
  for (const u of users) {
    if (isAdminUser(u)) continue;
    const age = (now - new Date(u.createdAt).getTime()) / DAY;
    const step = age >= 7 ? "d7" : age >= 3 ? "d3" : "d1";
    const trialLeft = u.trialEndsAt ? Math.max(0, Math.ceil((new Date(u.trialEndsAt).getTime() - now) / DAY)) : null;
    const mail = onboardingMail(u, step, { connected: Boolean(u.linkedin?.personToken || u.linkedin?.orgToken), drafts: u._count.drafts, trialLeft, facts: await accountFacts(u.id).catch(() => null) });
    if (await sendOnce(u, `onboarding:${step}`, mail)) sent++;
  }
  return { candidates: users.length, sent };
}

// Récapitulatif d'un compte à partir de ses données réelles (null s'il n'y a rien à dire) ; u : { id, email, name, agencyMembership }
export async function digestMailFor(u, { now = new Date(), since = new Date(now.getTime() - 7 * DAY), ahead = new Date(now.getTime() + 7 * DAY), agencyRestricted = new Map() } = {}) {
  if (u.agencyMembership) {
    const { agencyId, role } = u.agencyMembership;
    if (!agencyRestricted.has(agencyId)) agencyRestricted.set(agencyId, Boolean((await prisma.agency.findUnique({ where: { id: agencyId }, select: { restrictClients: true } }))?.restrictClients));
    const scope = { agencyId, ...(agencyRestricted.get(agencyId) && role !== "owner" ? { accessAsClient: { some: { memberId: u.id } } } : {}) };
    const clients = await prisma.user.findMany({ where: scope, select: { id: true, name: true, companyName: true } });
    if (!clients.length) return null;
    const drafts = await prisma.draft.findMany({
      where: { userId: { in: clients.map((c) => c.id) }, OR: [{ status: "publié", publishedAt: { gte: since } }, { status: "à valider" }, { status: "programmé", scheduledAt: { gte: now, lte: ahead } }] },
      select: { userId: true, status: true, clientFeedback: true, scheduledAt: true, performance: { select: { impressions: true } } },
    });
    const rows = clients.map((c) => {
      const d = drafts.filter((x) => x.userId === c.id);
      const next = d.filter((x) => x.status === "programmé" && x.scheduledAt).map((x) => new Date(x.scheduledAt).getTime()).sort((a, b) => a - b)[0];
      return { nextAt: next ? new Date(next) : null, impressions: d.filter((x) => x.status === "publié").reduce((t, x) => t + Math.max(0, ...x.performance.map((q) => q.impressions ?? 0)), 0), name: c.companyName || c.name, published: d.filter((x) => x.status === "publié").length, toValidate: d.filter((x) => x.status === "à valider" && !x.clientFeedback).length, changes: d.filter((x) => x.status === "à valider" && x.clientFeedback).length, scheduled: d.filter((x) => x.status === "programmé").length };
    }).filter((r) => r.published + r.toValidate + r.changes + r.scheduled > 0);
    return rows.length ? digestAgencyMail(u, rows) : null;
  }
  const drafts = await prisma.draft.findMany({
    where: { userId: u.id, OR: [{ status: "publié", publishedAt: { gte: since } }, { status: "à valider" }, { status: "programmé", scheduledAt: { gte: now, lte: ahead } }] },
    orderBy: { scheduledAt: "asc" },
    select: { status: true, text: true, scheduledAt: true, performance: { select: { impressions: true } } },
  });
  const pub = drafts.filter((d) => d.status === "publié"), toValidate = drafts.filter((d) => d.status === "à valider"), next = drafts.filter((d) => d.status === "programmé");
  if (!drafts.length) return null;
  const top = (arr) => arr.slice(0, 3);
  return digestSoloMail(u, {
    published: pub.length, scheduled: next.length, toValidate: toValidate.length,
    items: {
      published: top(pub).map((d) => { const imp = Math.max(0, ...d.performance.map((q) => q.impressions ?? 0)); return { excerpt: excerpt(d.text), impressions: d.performance.length ? imp : null }; }),
      next: top(next).map((d) => ({ excerpt: excerpt(d.text), at: d.scheduledAt })),
      pending: top(toValidate).map((d) => ({ excerpt: excerpt(d.text) })),
    },
  });
}

// Lien de partage du rapport d'un client : créé au besoin, au nom du propriétaire de l'agence (sa charte habille le rapport)
export async function ensureReportLink(clientId, agencyId) {
  let rl = await prisma.reportLink.findUnique({ where: { userId: clientId } });
  if (!rl) {
    const owner = await prisma.agencyMember.findFirst({ where: { agencyId, role: "owner" }, select: { userId: true } });
    const { newReportToken } = await import("./reportLink");
    rl = await prisma.reportLink.create({ data: { userId: clientId, token: newReportToken(), createdBy: owner?.userId ?? clientId } });
  }
  return rl;
}

// ── 3. Récapitulatif hebdomadaire (le lundi) ──────────────────────────────────────────
export async function runWeeklyDigest({ force = false, now = new Date() } = {}) {
  if (!force && (now.getDay() !== 1 || now.getHours() < 8)) return { skipped: true };
  const wk = isoWeekKey(now);
  const since = new Date(now.getTime() - 7 * DAY);
  const ahead = new Date(now.getTime() + 7 * DAY);
  const users = await prisma.user.findMany({
    where: { disabled: false, agencyId: null, emailOptOut: false },
    select: { id: true, email: true, name: true, role: true, agencyMembership: { select: { agencyId: true, role: true } } },
    take: 3000,
  });
  const agencyRestricted = new Map();
  let sent = 0;
  for (const u of users) {
    if (isAdminUser(u)) continue;
    try {
      const mail = await digestMailFor(u, { now, since, ahead, agencyRestricted });
      if (!mail) continue;
      if (await sendOnce(u, `digest:${wk}`, mail)) sent++;
    } catch (e) {
      console.error(`[engagement] récapitulatif ${u.id} :`, e.message);
    }
  }
  return { sent };
}

// ── 4. Pour l'agence : relances de validation et rapport du mois, envoyés au client ─────
export async function runClientReminders({ now = new Date() } = {}) {
  const links = await prisma.approvalLink.findMany({
    where: { autoReminders: true, sentTo: { not: null } },
    include: { user: { select: { id: true, name: true, companyName: true, agencyId: true, agency: { select: { name: true } } } } },
  });
  let sent = 0;
  for (const l of links) {
    if (!l.user?.agencyId) continue;
    const pending = await prisma.draft.findMany({ where: { userId: l.userId, status: "à valider", clientFeedback: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true, text: true, scheduledAt: true } });
    if (!pending.length) {
      if (l.remindersSent) await prisma.approvalLink.update({ where: { id: l.id }, data: { remindersSent: 0 } });
      continue;
    }
    if (l.remindersSent >= 3) continue;
    const oldest = Math.min(...pending.map((d) => new Date(d.createdAt).getTime()));
    const ref = Math.max(oldest, l.lastReminderAt ? new Date(l.lastReminderAt).getTime() : 0, l.lastSentAt ? new Date(l.lastSentAt).getTime() : 0);
    if (now.getTime() - ref < 3 * DAY) continue;
    const mail = reminderMail({ agency: l.user.agency?.name || "Votre agence", client: l.user.companyName || l.user.name, count: pending.length, token: l.token, posts: pendingPosts(pending, now), linkId: l.id });
    try {
      if (isMailerConfigured()) {
        await sendMail({ kind: "relance-client", to: l.sentTo, ...mail });
        await prisma.approvalLink.update({ where: { id: l.id }, data: { remindersSent: { increment: 1 }, lastReminderAt: now } });
        sent++;
      }
    } catch (e) {
      console.error(`[engagement] relance ${l.userId} :`, e.message);
    }
  }
  return { sent };
}

export async function runMonthlyClientReports({ force = false, now = new Date() } = {}) {
  if (!force && (now.getDate() > 3 || now.getHours() < 8)) return { skipped: true };
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const key = monthKey(prev);
  const links = await prisma.approvalLink.findMany({
    where: { autoReport: true, sentTo: { not: null }, OR: [{ lastReportKey: null }, { lastReportKey: { not: key } }] },
    include: { user: { select: { id: true, name: true, companyName: true, agencyId: true, agency: { select: { name: true } } } } },
  });
  let sent = 0;
  for (const l of links) {
    if (!l.user?.agencyId) continue;
    try {
      const report = await getMonthlyReport(l.userId, { year: prev.getFullYear(), month: prev.getMonth() + 1 });
      if (!report.postsPublished) { await prisma.approvalLink.update({ where: { id: l.id }, data: { lastReportKey: key } }); continue; }
      if (!isMailerConfigured()) continue;
      const rl = await ensureReportLink(l.userId, l.user.agencyId);
      const month = prev.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const mail = reportMail({ agency: l.user.agency?.name || "Votre agence", client: l.user.companyName || l.user.name, month, report, token: rl.token, linkId: l.id });
      await sendMail({ kind: "rapport-client", to: l.sentTo, ...mail });
      await prisma.approvalLink.update({ where: { id: l.id }, data: { lastReportKey: key } });
      sent++;
    } catch (e) {
      console.error(`[engagement] rapport ${l.userId} :`, e.message);
    }
  }
  return { sent };
}

// ── Passe horaire du planificateur ─────────────────────────────────────────────────────
// Dernière passe de chaque envoi (en mémoire : repart à zéro au redémarrage, la passe horaire suivante la remplit)
export const lastRuns = (globalThis.__emailRuns ??= {});
export const recordRun = (name, result) => { lastRuns[name] = { at: new Date().toISOString(), result: result ?? null }; };

export const ENGAGEMENT_JOBS = { quota: runQuotaAlerts, onboarding: runOnboardingEmails, digest: runWeeklyDigest, reminders: runClientReminders, reports: runMonthlyClientReports };
let lastRun = 0;
export async function runEngagementEmails() {
  if (Date.now() - lastRun < 60 * 60 * 1000) return { skipped: true };
  lastRun = Date.now();
  if (!isMailerConfigured()) return { skipped: "smtp" };
  const out = {};
  for (const [name, job] of Object.entries(ENGAGEMENT_JOBS)) {
    try { out[name] = await job(); recordRun(name, out[name]); } catch (e) { console.error(`[engagement] ${name} :`, e.message); recordRun(name, { error: e.message }); }
  }
  return out;
}
