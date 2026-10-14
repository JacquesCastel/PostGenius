import crypto from "crypto";

// Désinscription des e-mails d'accompagnement (accueil, récapitulatif hebdomadaire) : lien signé, sans connexion.
const secret = () => process.env.AUTH_SECRET || "dev-secret";
const base = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const unsubscribeToken = (userId) => crypto.createHmac("sha256", secret()).update(`unsub:${userId}`).digest("hex").slice(0, 32);
export const unsubscribeUrl = (userId) => `${base()}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
export function validUnsubscribe(userId, token) {
  const a = Buffer.from(String(token ?? ""));
  const b = Buffer.from(unsubscribeToken(String(userId ?? "")));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
