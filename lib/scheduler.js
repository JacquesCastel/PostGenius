import { prisma } from "./db";
import { publishForUser } from "./publish";
import { planCampaignForUser } from "./campaign";
import { sendPushToUser } from "./push";

// Publie tous les posts programmés arrivés à échéance.
// Appelé par le planificateur local (instrumentation.js, toutes les minutes)
// et par la route /api/cron/publish-due (Vercel Cron en production).

let running = false;

export async function runDuePublications() {
  if (running) return { skipped: true }; // évite les exécutions concurrentes
  running = true;
  const results = { published: 0, failed: 0 };

  try {
    const due = await prisma.draft.findMany({
      where: { status: "programmé", scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    });

    for (const draft of due) {
      try {
        const { postId } = await publishForUser(draft.userId, {
          text: draft.text,
          author: draft.target,
          imageUrl: draft.imageUrl,
        });
        await prisma.draft.update({
          where: { id: draft.id },
          data: { status: "publié", postId, publishedAt: new Date(), publishError: null },
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
      }
    }
  } finally {
    running = false;
  }

  // Pilote automatique (au plus une fois par heure)
  await runAutoGeneration().catch((e) => console.error("[autopilot]", e.message));

  // Rappels d'événements (notification jour-J)
  await runEventReminders().catch((e) => console.error("[events]", e.message));

  return results;
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
    where: { autoGenerate: true, publishDays: { not: null }, expertise: { not: null } },
    select: { id: true },
  });

  for (const u of users) {
    try {
      const r = await planCampaignForUser(u.id, { periodDays: 7, cap: 5 });
      if (r.created > 0) {
        console.log(`[autopilot] ${r.created} post(s) généré(s) pour l'utilisateur ${u.id} (${r.status})`);
      }
    } catch (e) {
      console.error(`[autopilot] utilisateur ${u.id}:`, e.message);
    }
  }
  return { users: users.length };
}
