import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { buildEmail } from "@/lib/emailLayout";

// Validation par le client final : un lien secret par client d'agence, sans compte (voir ApprovalLink).
const base = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const newApprovalToken = () => crypto.randomBytes(24).toString("hex"); // 48 caractères hexadécimaux
export const isApprovalToken = (t) => /^[a-f0-9]{48}$/.test(String(t ?? ""));
export const approvalUrl = (token) => `${base()}/valider/${token}`;

// Lien + client (compte géré par une agence uniquement) ; nul si le lien n'existe plus ou si le client a quitté l'agence
export async function findApprovalLink(token) {
  if (!isApprovalToken(token)) return null;
  const link = await prisma.approvalLink.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, companyName: true, agencyId: true, agency: { select: { name: true } } } } },
  });
  return link?.user?.agencyId ? link : null;
}

export function approvalMail({ token, clientName, agencyName }) {
  const from = agencyName || "Votre agence";
  return buildEmail({
    subject: `${from} — vos posts LinkedIn à valider`,
    eyebrow: from,
    title: "Vos posts LinkedIn sont prêts à relire",
    preheader: `${from} prépare les publications LinkedIn de ${clientName} : relisez-les et validez-les en un clic.`,
    paragraphs: [
      "Bonjour,",
      `<strong>${esc(from)}</strong> prépare les publications LinkedIn de ${esc(clientName)}. Relisez chaque post : validez-le d'un clic, ou demandez une modification. Aucun compte à créer.`,
      "Gardez cet e-mail : le même lien vous donnera accès aux prochains posts à valider.",
    ],
    cta: { label: "Voir les posts à valider", url: approvalUrl(token) },
  });
}

export async function sendApprovalEmail({ to, link, clientName, agencyName }) {
  try {
    return await sendMail({ kind: "validation-client", to, ...approvalMail({ token: link.token, clientName, agencyName }) });
  } catch (e) {
    console.error("[approval] envoi e-mail échoué :", e.message);
    return false;
  }
}

// Message à l'équipe de l'agence quand le client valide un post ou demande une modification
export function decisionMail({ clientName, approved, comment }) {
  const title = approved ? `${clientName} a validé un post` : `${clientName} demande des modifications`;
  const paragraphs = approved
    ? [`<strong>${esc(clientName)}</strong> a validé un post depuis son lien : il partira à la date prévue.`]
    : [`<strong>${esc(clientName)}</strong> demande des modifications sur un post :`, `<em>« ${esc(comment)} »</em>`, "Ouvrez « À traiter » pour le corriger : le post sera de nouveau soumis au client."];
  return buildEmail({ subject: `LinkeePost — ${title}`, eyebrow: "Validation client", title, paragraphs, cta: { label: "Ouvrir « À traiter »", url: `${base()}/app?view=queue` } });
}

// Prévient l'équipe de l'agence d'une décision du client (au mieux : n'échoue jamais)
export async function notifyAgencyOfDecision({ agencyId, clientName, approved, comment }) {
  try {
    const members = await prisma.agencyMember.findMany({ where: { agencyId }, select: { user: { select: { email: true } } } });
    const mail = decisionMail({ clientName, approved, comment });
    for (const m of members) if (m.user?.email) await sendMail({ kind: "decision-client", to: m.user.email, ...mail }).catch(() => {});
  } catch (e) {
    console.error("[approval] notification agence échouée :", e.message);
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
