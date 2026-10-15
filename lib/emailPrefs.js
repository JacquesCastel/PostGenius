import crypto from "crypto";

// Désinscription des e-mails d'accompagnement (accueil, récapitulatif hebdomadaire) : lien signé, sans connexion.
const secret = () => process.env.AUTH_SECRET || "dev-secret";
const base = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const unsubscribeToken = (userId) => crypto.createHmac("sha256", secret()).update(`unsub:${userId}`).digest("hex").slice(0, 32);
export const unsubscribeUrl = (userId) => `${base()}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;

// Client d'agence : désinscription d'un seul type d'envoi (relances ou rapport) pour un lien de validation précis
export const CLIENT_KINDS = { reminders: "autoReminders", report: "autoReport" };
export const clientUnsubscribeToken = (linkId, kind) => crypto.createHmac("sha256", secret()).update(`unsub-client:${linkId}:${kind}`).digest("hex").slice(0, 32);
export const clientUnsubscribeUrl = (linkId, kind) => `${base()}/api/email/unsubscribe-client?l=${encodeURIComponent(linkId)}&k=${kind}&t=${clientUnsubscribeToken(linkId, kind)}`;
export function validClientUnsubscribe(linkId, kind, token) {
  if (!CLIENT_KINDS[kind]) return false;
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(clientUnsubscribeToken(String(linkId ?? ""), kind));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function validUnsubscribe(userId, token) {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(unsubscribeToken(String(userId ?? "")));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
