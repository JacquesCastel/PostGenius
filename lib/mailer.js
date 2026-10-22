import nodemailer from "nodemailer";
import { prisma } from "./db";
import { CONTACT_EMAIL } from "./contact";

// Envoi d'emails. Si SMTP_HOST n'est pas configuré (dev), l'email n'est pas
// envoyé : la fonction renvoie false et l'appelant affiche le lien en console.

export function isMailerConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

// Comptes créés pour des clients d'agence sans adresse réelle : aucune boîte derrière, on n'envoie rien
const NO_MAILBOX = /@managed\.postgenius\.internal$/i;

// Adresse masquée pour le journal : seule l'initiale et le domaine restent lisibles
const mask = (a) => String(a ?? "").replace(/^(.).*?(@.*)$/, "$1***$2");

// Le journal ne doit jamais empêcher ni retarder un envoi
function logMail(data) {
  prisma.emailLog.create({ data }).catch(() => {});
}

// kind : type du message, pour le journal d'administration
export async function sendMail({ to, subject, text, html, kind = "autre", unsubscribeUrl = "", replyTo = "" }) {
  if (!isMailerConfigured()) return false;
  if (NO_MAILBOX.test(String(to ?? ""))) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "LinkeePost <no-reply@localhost>",
      to,
      subject,
      text,
      html,
      replyTo: replyTo || CONTACT_EMAIL, // sans adresse précise, les réponses arrivent dans la boîte de contact
      // Désinscription en un clic proposée par Gmail, Outlook, Apple Mail (RFC 8058)
      ...(unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    });
  } catch (e) {
    logMail({ kind, toMasked: mask(to), subject: String(subject ?? "").slice(0, 200), status: "échec", error: String(e.message ?? e).slice(0, 300) });
    throw e;
  }
  logMail({ kind, toMasked: mask(to), subject: String(subject ?? "").slice(0, 200), status: "envoyé" });
  return true;
}
