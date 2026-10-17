import { NextResponse } from "next/server";
import { requireAdmin, isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { isMailerConfigured } from "@/lib/mailer";
import { lastRuns } from "@/lib/engagementEmails";

// GET — état des e-mails automatiques : ce qui est actif, ce qui est parti sur 30 jours, qui est concerné maintenant, dernière passe (administrateur)
const DAY = 86400000;
const GROUPS = { welcome: "welcome", onboarding: "onboarding", trial_ending: "trial", trial_ended: "trialEnded", payment_failed: "payment", quota: "quota", digest: "digest" };

export async function GET(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const now = Date.now();
  const since = new Date(now - 30 * DAY);

  // Envois des 30 derniers jours, regroupés par type (la clé de chaque envoi commence par son type)
  const sentRows = await prisma.lifecycleEmail.findMany({ where: { sentAt: { gte: since } }, select: { key: true, sentAt: true }, take: 50000 });
  const sent = {};
  for (const r of sentRows) {
    const g = GROUPS[r.key.split(":")[0]];
    if (!g) continue;
    const s = (sent[g] ??= { n: 0, last: null });
    s.n++;
    if (!s.last || r.sentAt > s.last) s.last = r.sentAt;
  }

  // Comptes concernés maintenant (sans les administrateurs, jamais destinataires de ces messages)
  const people = await prisma.user.findMany({
    where: { disabled: false, agencyId: null },
    select: { id: true, email: true, role: true, createdAt: true, trialEndsAt: true, emailOptOut: true, subscriptionStatus: true, agencyMembership: { select: { agencyId: true } } },
    take: 5000,
  });
  const users = people.filter((u) => !isAdminUser(u));
  const onboarding = users.filter((u) => !u.emailOptOut && !u.agencyMembership && new Date(u.createdAt).getTime() >= now - 10 * DAY && new Date(u.createdAt).getTime() <= now - DAY).length;
  const trial = users.filter((u) => u.trialEndsAt && new Date(u.trialEndsAt).getTime() > now && new Date(u.trialEndsAt).getTime() <= now + 3 * DAY && !["active", "trialing"].includes(u.subscriptionStatus)).length;
  const trialEnded = users.filter((u) => u.trialEndsAt && new Date(u.trialEndsAt).getTime() <= now && new Date(u.trialEndsAt).getTime() > now - 7 * DAY && !["active", "trialing", "past_due"].includes(u.subscriptionStatus)).length;
  const digest = users.filter((u) => !u.emailOptOut).length;
  const [reminders, reports, remindedLinks, reportedLinks] = await Promise.all([
    prisma.approvalLink.count({ where: { autoReminders: true, sentTo: { not: null } } }),
    prisma.approvalLink.count({ where: { autoReport: true, sentTo: { not: null } } }),
    prisma.approvalLink.count({ where: { lastReminderAt: { gte: since } } }),
    prisma.approvalLink.count({ where: { lastReportKey: { not: null } } }),
  ]);

  // Commentaires de page : clients d'agence dont la page est connectée, et notifications envoyées sur 30 jours
  const [commentPages, commentRows] = await Promise.all([
    prisma.linkedInAccount.count({ where: { orgToken: { not: null }, user: { agencyId: { not: null }, disabled: false } } }),
    prisma.agencyNotification.findMany({ where: { kind: "page_comment", createdAt: { gte: since } }, select: { createdAt: true }, take: 20000 }),
  ]);
  const commentNotifs = { n: commentRows.length, last: commentRows.reduce((m, r) => (!m || r.createdAt > m ? r.createdAt : m), null) };

  const run = (k) => lastRuns[k] ?? null;
  const jobs = [
    { id: "welcome", label: "Bienvenue", when: "À l'inscription", sent: sent.welcome?.n ?? 0, last: sent.welcome?.last ?? null, eligible: null, run: null },
    { id: "onboarding", label: "Accueil (jours 1, 3 et 7)", when: "1 à 10 jours après l'inscription, hors comptes d'agence", sent: sent.onboarding?.n ?? 0, last: sent.onboarding?.last ?? null, eligible: onboarding, lastRun: run("onboarding"), run: "onboarding" },
    { id: "trial", label: "Fin d'essai", when: "3 jours avant la fin de l'essai", sent: sent.trial?.n ?? 0, last: sent.trial?.last ?? null, eligible: trial, lastRun: run("trial"), run: null },
    { id: "trialEnded", label: "Essai terminé", when: "À la fin de l'essai, sans abonnement (une seule fois)", sent: sent.trialEnded?.n ?? 0, last: sent.trialEnded?.last ?? null, eligible: trialEnded, lastRun: run("trial"), run: null },
    { id: "payment", label: "Paiement échoué", when: "Quand Stripe signale un échec de paiement", sent: sent.payment?.n ?? 0, last: sent.payment?.last ?? null, eligible: null, run: null },
    { id: "quota", label: "Alerte de quota", when: "À 80 % puis à 100 % d'une limite", sent: sent.quota?.n ?? 0, last: sent.quota?.last ?? null, eligible: null, lastRun: run("quota"), run: "quota" },
    { id: "digest", label: "Récapitulatif de la semaine", when: "Chaque lundi à partir de 8 h (heure du serveur), s'il y a de l'activité", sent: sent.digest?.n ?? 0, last: sent.digest?.last ?? null, eligible: digest, lastRun: run("digest"), run: "digest" },
    { id: "reminders", label: "Relance de validation (clients des agences)", when: "Tous les 3 jours, 3 relances au plus, pour les clients où l'agence l'a activée", sent: remindedLinks, last: null, eligible: reminders, lastRun: run("reminders"), run: "reminders" },
    { id: "comments", label: "Commentaires de page (clients d'agence et pages personnelles)", when: "Toutes les 10 minutes : nouveaux commentaires et mentions sur une page LinkedIn connectée. Client d'agence : cloche et e-mail de l'équipe ; page personnelle : notification et e-mail", sent: commentNotifs.n, last: commentNotifs.last, eligible: commentPages, lastRun: run("comments"), run: "comments" },
    { id: "reports", label: "Rapport du mois (clients des agences)", when: "Du 1er au 3 du mois, pour les clients où l'agence l'a activé", sent: reportedLinks, last: null, eligible: reports, lastRun: run("reports"), run: "reports" },
  ];
  return NextResponse.json({
    smtp: isMailerConfigured(),
    scheduler: process.env.DISABLE_LOCAL_SCHEDULER !== "1",
    jobs,
  });
}
