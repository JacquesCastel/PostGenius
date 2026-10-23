import { prisma } from "./db";
import { getContextFor } from "./contexts";

// Temps forts : un moment précis rattaché à une thématique (voix, cible et datalake de la thématique, plus le brief et les sources du temps fort).
export const MAX_MOMENTS = 30;

const clip = (v, n) => String(v ?? "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const toDate = (v) => {
  if (v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// Champs reçus du client → champs acceptés (seuls ceux présents sont renvoyés ; `bad` liste ceux qui sont invalides)
export function cleanMomentInput(body = {}) {
  const out = {};
  const bad = [];
  if (body.name !== undefined) out.name = clip(body.name, 120);
  if (body.brief !== undefined) out.brief = clip(body.brief, 600) || null;
  for (const k of ["startsAt", "endsAt"]) {
    if (body[k] === undefined) continue;
    const d = toDate(body[k]);
    if (d === undefined) bad.push(k);
    else out[k] = d;
  }
  if (out.startsAt && out.endsAt && out.endsAt < out.startsAt) bad.push("endsAt");
  if (typeof body.archived === "boolean") out.archivedAt = body.archived ? new Date() : null;
  return { data: out, bad };
}

// Un temps fort est « en cours » tant qu'il n'est pas archivé et que sa fin n'est pas passée (jusqu'à la fin du jour de fin)
export function momentState(m, now = new Date()) {
  if (m.archivedAt) return "archived";
  if (m.endsAt && new Date(m.endsAt).getTime() + 86400_000 <= now.getTime()) return "ended";
  if (m.startsAt && new Date(m.startsAt).getTime() > now.getTime()) return "upcoming";
  return "active";
}

export async function getMomentFor(userId, momentId) {
  if (!userId || !momentId || typeof momentId !== "string") return null;
  return prisma.moment.findFirst({ where: { id: momentId, userId } });
}

// Bloc ajouté aux connaissances d'une génération : le temps fort en cours et ce que l'auteur veut y dire
export function momentBlock(m) {
  if (!m) return "";
  const when = [m.startsAt && `du ${new Date(m.startsAt).toLocaleDateString("fr-FR")}`, m.endsAt && `au ${new Date(m.endsAt).toLocaleDateString("fr-FR")}`].filter(Boolean).join(" ");
  return `\n\nTEMPS FORT EN COURS : « ${m.name} »${when ? ` (${when})` : ""}.${m.brief ? ` Ce que l'auteur veut dire : ${m.brief}` : ""}\nCe post s'inscrit dans ce temps fort : sers-t'en comme fil rouge, sans en faire un communiqué.`;
}

// Portée d'une source reçue du client, avec un éventuel temps fort : il impose la thématique et exclut le partage
export async function resolveMomentScope(userId, raw, scope) {
  const id = raw?.momentId && raw.momentId !== "none" ? String(raw.momentId) : null;
  if (!id) return { ...scope, momentId: null };
  const m = await getMomentFor(userId, id);
  if (!m) throw new Error("Temps fort introuvable.");
  return { contextId: m.contextId ?? null, shared: false, momentId: m.id };
}

export { getContextFor };
