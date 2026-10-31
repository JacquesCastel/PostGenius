import { prisma } from "./db";
import { liCalls } from "./aiGuard";

// Compteur d'appels à l'API LinkedIn par jour : versé en base chaque minute par le planificateur (SiteContent « li-calls », 35 jours).
const KEY = "li-calls";

export async function readLinkedinCalls() {
  const row = await prisma.siteContent.findUnique({ where: { key: KEY } });
  let v = {};
  try { v = row ? JSON.parse(row.value) : {}; } catch {}
  return v;
}

export async function flushLinkedinCalls() {
  const days = Object.keys(liCalls);
  if (!days.length) return;
  const stored = await readLinkedinCalls();
  for (const d of days) {
    const add = liCalls[d];
    if (!add.n && !add.err && !add.r429) continue;
    const [n, err, r429] = [add.n, add.err, add.r429];
    const cur = (stored[d] ??= { n: 0, err: 0, r429: 0 });
    cur.n += n; cur.err += err; cur.r429 += r429;
    add.n = 0; add.err = 0; add.r429 = 0; // remis à zéro sur place : ce qui est versé ne l'est qu'une fois
  }
  const keep = Object.keys(stored).sort().slice(-35);
  const out = Object.fromEntries(keep.map((k) => [k, stored[k]]));
  await prisma.siteContent.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(out) }, update: { value: JSON.stringify(out) } });
}
