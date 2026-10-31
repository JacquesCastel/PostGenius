import crypto from "crypto";
import { sendMail } from "./mailer";
import { buildEmail, escHtml } from "./emailLayout";
import { CONTACT_EMAIL } from "./contact";

// Invitations de test : un admin invite une adresse e-mail ; le lien permet de créer un compte avec un
// accès gratuit à l'offre INVITE_PLAN pendant INVITE_ACCESS_DAYS jours, sans paiement.

export const INVITE_PLAN = "pro"; // un testeur est un utilisateur individuel : Pro (profil + page entreprise). L'offre Agence ouvre l'espace clients, inutile pour un test
export const INVITE_ACCESS_DAYS = 14; // durée de l'accès offert, à partir de la création du compte
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

// Message d'invitation (le même pour l'envoi réel et pour les tests de l'administration)
export function invitationMail(inv, inviterName) {
  const who = inviterName ? `${inviterName} vous invite` : "Vous êtes invité(e)";
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return buildEmail({
    subject: "LinkeePost — votre invitation à la bêta fermée",
    eyebrow: "Bêta fermée",
    title: "Vous êtes invité(e) à tester LinkeePost",
    preheader: `${who} à rejoindre la bêta fermée de LinkeePost : ${INVITE_ACCESS_DAYS} jours offerts.`,
    paragraphs: [
      "Bonjour,",
      `${escHtml(who)} à rejoindre la <strong>bêta fermée de LinkeePost</strong>, l'outil qui prépare, programme et mesure vos posts LinkedIn. Vous faites partie d'un petit groupe : les places sont limitées.`,
      `<strong>Ce que vous recevez :</strong> un accès complet à l'offre Pro, <strong>gratuit pendant ${INVITE_ACCESS_DAYS} jours</strong>, sans carte bancaire ni engagement.`,
      "<strong>Ce que nous attendons :</strong> utilisez LinkeePost sur de vrais posts, et donnez-nous un court retour chaque semaine (une dizaine de minutes). Dites-nous franchement ce qui bloque ou ce qui manque : c'est tout l'intérêt de la bêta.",
      "<strong>Pour commencer :</strong> créez votre compte avec cette adresse e-mail, connectez votre profil LinkedIn (par la connexion officielle de LinkedIn : nous ne voyons jamais votre mot de passe), puis écrivez votre premier post. Rien n'est publié sans votre action.",
      `Une question, un blocage ? Répondez simplement à ce message ou écrivez à ${escHtml(CONTACT_EMAIL)}. Vous trouverez le détail de la bêta sur ${escHtml(base)}/beta.`,
    ],
    cta: { label: "Accepter l'invitation", url: inviteUrl(inv.token) },
    note: `Ce lien est valable ${INVITE_LINK_DAYS} jours et ne sert qu'une fois.`,
  });
}

// Envoie l'e-mail d'invitation. Renvoie true si envoyé ; ne lève jamais (le lien reste copiable en admin).
export async function sendInvitationEmail(inv, inviterName) {
  try {
    return await sendMail({ kind: "invitation-test", to: inv.email, ...invitationMail(inv, inviterName) });
  } catch (e) {
    console.error("[invitations] envoi e-mail échoué :", e.message);
    return false;
  }
}
