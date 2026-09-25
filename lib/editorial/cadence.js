import { prisma } from "../db";

// Suggestion de créneau de publication à partir des VRAIES performances mesurées
// (lib/editorial/performance.js), pas d'un modèle entraîné — même logique de prudence
// que lib/editorial/learning.js : sous un volume minimum, un écart entre jours est du
// bruit, pas un signal. Ne remplace rien : une proposition qu'on applique d'un clic ou
// qu'on ignore, le rythme reste piloté à la main sinon.

const MIN_SLOT_SAMPLES = 3; // postes minimum sur UN jour pour le considérer fiable
const MIN_TOTAL_SAMPLES = 8; // total minimum avant de proposer quoi que ce soit

// 1 = lundi … 7 = dimanche, comme WEEK_DAYS côté interface (app/app/page.js)
function isoDay(date) {
  return ((date.getDay() + 6) % 7) + 1;
}

export async function getSuggestedSlot(userId) {
  const rows = await prisma.postPerformance.findMany({
    where: { offsetHours: 168, draft: { userId } }, // J+7 : mesure stabilisée
    select: {
      impressions: true,
      likes: true,
      comments: true,
      shares: true,
      draft: { select: { publishedAt: true } },
    },
  });

  const withRate = rows
    .filter((r) => r.impressions && r.draft?.publishedAt)
    .map((r) => {
      const d = new Date(r.draft.publishedAt);
      return {
        day: isoDay(d),
        hour: d.getHours(),
        rate: ((r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0)) / r.impressions,
      };
    });

  if (withRate.length < MIN_TOTAL_SAMPLES) return null;

  // Regroupe par jour de la semaine : à ce volume, c'est le signal le plus stable
  // (l'heure précise varie trop peu de post en post pour être fiable seule).
  const byDay = {};
  for (const r of withRate) {
    byDay[r.day] ??= { sum: 0, n: 0, hours: [] };
    byDay[r.day].sum += r.rate;
    byDay[r.day].n++;
    byDay[r.day].hours.push(r.hour);
  }

  let best = null;
  for (const [day, { sum, n, hours }] of Object.entries(byDay)) {
    if (n < MIN_SLOT_SAMPLES) continue;
    const avgRate = sum / n;
    if (!best || avgRate > best.avgRate) {
      const sortedHours = [...hours].sort((a, b) => a - b);
      best = { day: Number(day), avgRate, sampleSize: n, hour: sortedHours[Math.floor(sortedHours.length / 2)] };
    }
  }
  if (!best) return null;

  return {
    day: best.day,
    time: `${String(best.hour).padStart(2, "0")}:00`,
    sampleSize: best.sampleSize,
    totalSamples: withRate.length,
    engagementRate: Math.round(best.avgRate * 1000) / 10, // en %, 1 décimale
  };
}
