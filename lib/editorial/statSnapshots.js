import { prisma } from "../db";
import { decryptToken } from "../crypto";
import { fetchMemberMetrics } from "../linkedin/memberStats";

// Relevé quotidien des totaux du profil personnel (r_member_postAnalytics) : l'API ne donne que le cumul à la date de la demande,
// l'évolution se déduit de la différence entre deux relevés. Un relevé par compte et par jour (heure de Paris), 6 appels par relevé.

const METRICS = ["IMPRESSION", "REACTION", "COMMENT", "RESHARE", "LINK_CLICKS", "MEMBERS_REACHED"];
const MAX_USERS_PER_RUN = 40;
const THROTTLE_MS = 60 * 60 * 1000; // vérifie au plus une fois par heure
let lastRun = 0;

export const parisDayString = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(d); // AAAA-MM-JJ

export async function captureDailyProfileSnapshots({ force = false } = {}) {
  if (!force && Date.now() - lastRun < THROTTLE_MS) return { skipped: true };
  lastRun = Date.now();
  const day = parisDayString();
  const accounts = await prisma.linkedInAccount.findMany({
    where: { statsToken: { not: null }, user: { disabled: false, statSnapshots: { none: { day } } } },
    select: { userId: true, statsToken: true, statsExpiresAt: true },
    take: MAX_USERS_PER_RUN,
  });
  let captured = 0;
  for (const acc of accounts) {
    const token = decryptToken(acc.statsToken);
    if (!token || (acc.statsExpiresAt && acc.statsExpiresAt < new Date())) continue;
    const m = await fetchMemberMetrics(token, METRICS);
    if (Object.values(m).every((v) => v == null)) continue; // permission absente ou session refusée : rien à enregistrer
    try {
      await prisma.statSnapshot.create({ data: { userId: acc.userId, day, impressions: m.IMPRESSION, reactions: m.REACTION, comments: m.COMMENT, shares: m.RESHARE, clicks: m.LINK_CLICKS, reached: m.MEMBERS_REACHED } });
      captured++;
    } catch (e) {
      if (e.code !== "P2002") console.error("[stat-snapshots]", e.message); // P2002 : relevé du jour déjà fait par un autre passage
    }
  }
  return { captured };
}
