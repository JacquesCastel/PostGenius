import crypto from "crypto";
import { sendMail } from "./mailer";

// Invitations de test : un admin invite une adresse e-mail ; le lien permet de créer un compte avec un
// accès gratuit à l'offre INVITE_PLAN pendant INVITE_ACCESS_DAYS jours, sans paiement.

export const INVITE_PLAN = "agence"; // l'offre la plus complète : le testeur voit tout le produit
export const INVITE_ACCESS_DAYS = 30; // durée de l'accès offert, à partir de la création du compte
export const INVITE_LINK_DAYS = 14; // durée de validité du lien

export const normalizeEmail = (e) => String(e ?? "").trim().toLowerCase();
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(e));
export const newInviteToken = () => crypto.randomBytes(24).toString("hex");
export const linkExpiry = (from = Date.now()) => new Date(from + INVITE_LINK_DAYS * 86400000);

// pending | accepted | revoked | expired (l'acceptation et la révocation priment sur l'expiration)
export function inviteStatus(inv, now = Date.now()) {
  if (inv.acceptedAt) return "accepted";
  if (inv.revokedAt) return "revoked";
  if (new Date(inv.expiresAt).getTime() <= now) return "expired";
  return "pending";
}

export function inviteUrl(token) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/app?invite=${token}`;
}

// Envoie l'e-mail d'invitation. Renvoie true si envoyé ; ne lève jamais (le lien reste copiable en admin).
export async function sendInvitationEmail(inv, inviterName) {
  const link = inviteUrl(inv.token);
  const who = inviterName ? `${inviterName} vous invite` : "Vous êtes invité(e)";
  try {
    return await sendMail({
      to: inv.email,
      subject: "LinkeePost — votre invitation pour tester",
      text: `Bonjour,\n\n${who} à tester LinkeePost, l'outil qui prépare et publie vos posts LinkedIn.\n\nVotre accès est gratuit pendant ${INVITE_ACCESS_DAYS} jours, sans carte bancaire. Créez votre compte avec cette adresse e-mail :\n${link}\n\nCe lien est valable ${INVITE_LINK_DAYS} jours.`,
      html: `<p>Bonjour,</p><p>${who} à tester <strong>LinkeePost</strong>, l'outil qui prépare et publie vos posts LinkedIn.</p><p>Votre accès est <strong>gratuit pendant ${INVITE_ACCESS_DAYS} jours</strong>, sans carte bancaire. Créez votre compte avec cette adresse e-mail :</p><p><a href="${link}">Accepter l'invitation</a></p><p>Ce lien est valable ${INVITE_LINK_DAYS} jours.</p>`,
    });
  } catch (e) {
    console.error("[invitations] envoi e-mail échoué :", e.message);
    return false;
  }
}
