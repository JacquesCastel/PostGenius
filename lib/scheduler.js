import { purgeActivity } from "./activity";
import { purgeSiteVisits } from "./siteStats";
import { flushLinkedinCalls } from "./linkedinCalls";
import { prisma } from "./db";
import { publishForUser } from "./publish";
import { isClientAccount, personalProfileBlocked } from "./clientAccount";
import { checkAccess } from "./gating";
import { notifyAgency, clientLabel, runToValidateNotifications } from "./agencyNotify";
import { publishErrorMail, runTeamDigest } from "./teamEmails";
import { runPageCommentNotifications } from "./pageComments";
import { purgeExpiredLeads } from "./leads";
import { parseMentions } from "./mentions";
import { planCampaignForUser } from "./campaign";
import { sendPushToUser } from "./push";
import { runEditorialAutopilot } from "./editorial/autopilot";
import { capturePerformanceSnapshots } from "./editorial/performance";
import { captureDailyProfileSnapshots } from "./editorial/statSnapshots";
import { runTrialEndingEmails } from "./lifecycleEmails";
import { cleanupVideos } from "./video";
import { runBackupAlert } from "./backupHealth";
import { runDiskAlert } from "./diskAlert";
import { runEngagementEmails } from "./engagementEmails";

// Publie tous les posts programmés arrivés à échéance.
// Appelé par le planificateur local (instrumentation.js, toutes les minutes)
// et par la route /api/cron/publish-due (Vercel Cron en production).

let running = false;

export async function runDuePublications() {
  if (running) return { skipped: true }; // évite les exécutions concurrentes
  running = true;
  const results = { published: 0, failed: 0 };
  const sched = (globalThis.__schedulerState ??= { lastRunAt: null, lastOkAt: null, lastError: null, lastPublished: 0, lastFailed: 0 });
  sched.lastRunAt = Date.now();

  try {
    const due = await prisma.draft.findMany({
      where: { status: "programmé", scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    });

    for (const draft of due) {
      try {
        // Client d'agence : si l'essai ou l'abonnement de l'agence est terminé, le post ne part pas (il passe en erreur, à reprogrammer
        // une fois l'accès rétabli) — sans cela, un client continuerait de publier gratuitement
        if (await isClientAccount(draft.userId)) {
          const access = await checkAccess(draft.userId);
          if (!access.ok) throw new Error(access.error);
        }
        // Compte client d'une agence : un post resté sur « profil » part sur la page du client, jamais sur un profil
        let author = draft.target;
        if ((!author || author === "person") && (await personalProfileBlocked(draft.userId))) {
          const acc = await prisma.linkedInAccount.findUnique({ where: { userId: draft.userId }, select: { orgUrn: true } });
          if (acc?.orgUrn) author = acc.orgUrn;
        }
        const { postId, firstComment: fc } = await publishForUser(draft.userId, {
          text: draft.text,
          author,
          imageUrl: draft.imageUrl,
          videoUrl: draft.videoUrl,
          youtubeUrl: draft.youtubeUrl,
          mentions: parseMentions(draft.mentions),
          poll: draft.poll,
          documentSlides: draft.documentSlides,
          documentTitle: draft.theme,
          firstComment: draft.firstComment,
        });
        await prisma.draft.update({
          where: { id: draft.id },
          data: { status: "publié", postId, publishedAt: new Date(), publishError: null, ...(fc?.ok ? { firstCommentAt: new Date() } : {}) },
        });
        results.published++;
        console.log(`[scheduler] Post ${draft.id} publié (${postId})`);
      } catch (e) {
        await prisma.draft.update({
          where: { id: draft.id },
          data: { status: "erreur", publishError: e.message },
        });
        results.failed++;
        console.error(`[scheduler] Échec post ${draft.id}:`, e.message);
        // Client d'agence : l'équipe concernée est prévenue (cloche), sans attendre qu'on ouvre « À traiter »
        const owner = await prisma.user.findUnique({ where: { id: draft.userId }, select: { id: true, name: true, companyName: true, agencyId: true } }).catch(() => null);
        if (owner?.agencyId) {
          // Une alerte par client et par tranche de 6 heures : un lot de posts en échec ne doit pas inonder l'équipe (cloche et e-mail)
          const recent = await prisma.agencyNotification.findFirst({ where: { agencyId: owner.agencyId, clientId: owner.id, kind: "publish_error", createdAt: { gte: new Date(Date.now() - 6 * 3600000) } }, select: { id: true } });
          if (!recent) {
            await notifyAgency({ agencyId: owner.agencyId, clientId: owner.id, kind: "publish_error", view: "queue", title: `Publication échouée pour ${clientLabel(owner)}`, body: String(e.message).slice(0, 200), email: publishErrorMail(clientLabel(owner), e.message) });
          }
        }
      }
    }
    sched.lastOkAt = Date.now();
    sched.lastPublished = results.published;
    sched.lastFailed = results.failed;
    sched.lastError = null;
  } catch (e) {
    sched.lastError = String(e?.message ?? e).slice(0, 300);
    throw e;
  } finally {
    running = false;
  }

  // Pilote automatique (au plus une fois par heure)
  await runAutoGeneration().catch((e) => console.error("[autopilot]", e.message));

  // Publication autonome depuis le copilote éditorial (opt-in, voir
  // lib/editorial/autopilot.js) — au plus une fois par heure également.
  await runEditorialAutopilot().catch((e) => console.error("[autopilot-editorial]", e.message));

  // Rappels d'événements (notification jour-J)
  await runEventReminders().catch((e) => console.error("[events]", e.message));

  // Historique de performance réelle des posts publiés sur les pages entreprise
  // (voir lib/editorial/performance.js), au plus une fois toutes les 3 h.
  await capturePerformanceSnapshots().catch((e) => console.error("[performance]", e.message));

  // Relevé quotidien des totaux du profil personnel (courbe d'évolution de l'écran Statistiques)
  await captureDailyProfileSnapshots().catch((e) => console.error("[stat-snapshots]", e.message));

  // Email « votre essai se termine bientôt » (J-3), au plus une fois par heure
  await runTrialEndingEmails().catch((e) => console.error("[lifecycle]", e.message));

  // E-mails d'accompagnement : alertes de quota, accueil, récapitulatif hebdomadaire, relances et rapports pour les clients d'agence
  await runEngagementEmails().catch((e) => console.error("[engagement]", e.message));

  // Notifications d'équipe : posts arrivés « à valider » chez les clients d'agence (au plus toutes les 5 minutes)
  await runToValidateNotifications().catch((e) => console.error("[notifications]", e.message));

  // Commentaires et mentions des pages des clients d'agence → cloche et e-mail de l'équipe (au plus toutes les 10 minutes)
  await runPageCommentNotifications().catch((e) => console.error("[comments]", e.message));

  // Données LinkedIn des leads : profil effacé après 24 h, lead effacé après 48 h (exigences de stockage de LinkedIn)
  await purgeExpiredLeads().catch((e) => console.error("[leads-purge]", e.message));

  // Récapitulatif quotidien de l'équipe d'agence (jours ouvrés, à partir de 8 h) : ce qui attend chaque membre sur ses clients
  await runTeamDigest().catch((e) => console.error("[team-digest]", e.message));

  // Compteur d'appels à l'API LinkedIn : versé en base
  await flushLinkedinCalls().catch((e) => console.error("[li-calls]", e.message));

  // Mesure d'audience du site : 13 mois
  await purgeSiteVisits().catch((e) => console.error("[site-stats-purge]", e.message));

  // Journal d'activité d'exploitation : 13 mois
  await purgeActivity().catch((e) => console.error("[activity-purge]", e.message));

  // Journal des e-mails : 90 jours de mémoire
  await prisma.emailLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } } }).catch((e) => console.error("[email-log]", e.message));

  // Notifications d'équipe : 30 jours pour les lues, 90 jours pour les autres
  await prisma.agencyNotification.deleteMany({ where: { OR: [{ readAt: { lt: new Date(Date.now() - 30 * 86400000) } }, { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } }] } }).catch((e) => console.error("[notifications]", e.message));

  // Entretien des vidéos (envois interrompus, orphelines, anciens posts publiés)
  await runVideoCleanup().catch((e) => console.error("[videos]", e.message));

  // Alerte email si les sauvegardes sont en échec ou n'ont pas tourné
  await runBackupAlertHourly().catch((e) => console.error("[backup-alert]", e.message));

  // Alerte d'espace disque (80 % / 90 %) aux administrateurs
  await runDiskAlertHourly().catch((e) => console.error("[disk-alert]", e.message));

  return results;
}

let lastDiskAlert = 0;
async function runDiskAlertHourly() {
  if (Date.now() - lastDiskAlert < 3600e3) return;
  lastDiskAlert = Date.now();
  const { sent } = await runDiskAlert(prisma);
  if (sent) console.log(`[disk-alert] ${sent} e-mail(s) d'alerte envoyé(s)`);
}

let lastBackupAlert = 0;
async function runBackupAlertHourly() {
  if (Date.now() - lastBackupAlert < 3600e3) return;
  lastBackupAlert = Date.now();
  const { sent } = await runBackupAlert(prisma);
  if (sent) console.log(`[backup-alert] ${sent} email(s) d'alerte envoyé(s)`);
}

let lastVideoCleanup = 0;
async function runVideoCleanup() {
  if (Date.now() - lastVideoCleanup < 3600e3) return;
  lastVideoCleanup = Date.now();
  const { removed } = await cleanupVideos(prisma);
  if (removed) console.log(`[videos] ${removed} fichier(s) supprimé(s)`);
}

// Notifie chaque utilisateur le jour où son événement a lieu (une fois par événement).
export async function runEventReminders() {
  const now = new Date();
  if (now.getHours() < 8) return { skipped: true }; // pas avant 8 h

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      startDate: { lte: endOfToday },
      endDate: { gte: startOfToday },
      remindedAt: null,
    },
    take: 50,
  });

  for (const ev of events) {
    try {
      await sendPushToUser(ev.userId, {
        title: `Vous êtes à ${ev.name} !`,
        body: "N'oubliez pas de poster et de prendre une photo sur place 📸",
        url: "/app?view=events",
        tag: `event-${ev.id}`,
      });
      await prisma.event.update({ where: { id: ev.id }, data: { remindedAt: now } });
      console.log(`[events] Rappel envoyé pour « ${ev.name} » (user ${ev.userId})`);
    } catch (e) {
      console.error(`[events] Rappel ${ev.id}:`, e.message);
    }
  }
  return { reminded: events.length };
}

// Pilote automatique : pour les utilisateurs qui l'ont activé, génère les
// posts manquants sur les créneaux des 7 prochains jours.
let lastAutoGen = 0;

export async function runAutoGeneration() {
  if (Date.now() - lastAutoGen < 60 * 60 * 1000) return { skipped: true };
  lastAutoGen = Date.now();

  const users = await prisma.user.findMany({
    // Seulement les comptes qui ont une campagne active à alimenter : sans campagne, rien n'est généré automatiquement
    where: { autoGenerate: true, publishDays: { not: null }, expertise: { not: null }, campaigns: { some: { status: "active" } } },
    select: { id: true },
  });

  for (const u of users) {
    try {
      const r = await planCampaignForUser(u.id, { periodDays: 7, cap: 5, requireCampaign: true });
      if (r.created > 0) {
        console.log(`[autopilot] ${r.created} post(s) généré(s) pour l'utilisateur ${u.id} (${r.status})`);
      }
    } catch (e) {
      console.error(`[autopilot] utilisateur ${u.id}:`, e.message);
    }
  }
  return { users: users.length };
}
