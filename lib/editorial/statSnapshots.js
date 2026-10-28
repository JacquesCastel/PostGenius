import { prisma } from "../db";
import { captureProfileStats, utcDay } from "../linkedin/profileStats";

// Relevé quotidien des statistiques du profil personnel : un seul passage par compte et par jour UTC, le premier de la journée (LinkedIn remet ses
// compteurs d'appels à zéro à minuit UTC). L'écran « Statistiques » lit ce relevé (voir lib/linkedin/profileStats.js).

const MAX_USERS_PER_RUN = 40;
const THROTTLE_MS = 60 * 60 * 1000; // vérifie au plus une fois par heure : un passage refusé (quota) est retenté plus tard dans la journée
let lastRun = 0;

export async function captureDailyProfileSnapshots({ force = false } = {}) {
  if (!force && Date.now() - lastRun < THROTTLE_MS) return { skipped: true };
  lastRun = Date.now();
  const day = utcDay();
  const accounts = await prisma.linkedInAccount.findMany({
    where: { statsToken: { not: null }, user: { disabled: false, statSnapshots: { none: { day, detailed: true } } } },
    select: { userId: true },
    take: MAX_USERS_PER_RUN,
  });
  let captured = 0;
  for (const { userId } of accounts) {
    const r = await captureProfileStats(userId).catch((e) => ({ error: e.message }));
    if (r.snapshot && !r.skipped) captured++;
  }
  return { captured };
}
