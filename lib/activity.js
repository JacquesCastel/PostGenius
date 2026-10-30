import { prisma } from "./db";

// Journal d'activité d'exploitation. Ne doit JAMAIS gêner le parcours de l'utilisateur : toute erreur est avalée.
const g = globalThis;
const seenToday = (g.__activitySeen ??= new Map()); // userId:kind → jour (évite une écriture à chaque requête)

export async function logActivity(userId, kind, meta) {
  try {
    await prisma.activityEvent.create({ data: { userId: userId ?? null, kind, meta: meta ?? undefined } });
  } catch (e) {
    console.error("[activity]", e?.message);
  }
}

// Au plus une fois par jour et par utilisateur (jour « actif » : ouverture de l'application avec une session valide)
export async function logActiveOncePerDay(userId, kind = "active") {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${kind}`;
  if (seenToday.get(key) === day) return;
  seenToday.set(key, day);
  if (seenToday.size > 5000) seenToday.clear();
  try {
    const start = new Date(`${day}T00:00:00.000Z`);
    const already = await prisma.activityEvent.findFirst({ where: { userId, kind, createdAt: { gte: start } }, select: { id: true } });
    if (!already) await prisma.activityEvent.create({ data: { userId, kind } });
  } catch (e) {
    console.error("[activity]", e?.message);
  }
}

export async function purgeActivity() {
  const limit = new Date(Date.now() - 400 * 86400000); // 13 mois
  await prisma.activityEvent.deleteMany({ where: { createdAt: { lt: limit } } });
}
