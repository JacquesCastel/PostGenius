import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";

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

export async function sendApprovalEmail({ to, link, clientName, agencyName }) {
  const url = approvalUrl(link.token);
  const from = agencyName || "Votre agence";
  try {
    return await sendMail({
      to,
      subject: `${from} — vos posts LinkedIn à valider`,
      text: `Bonjour,\n\n${from} prépare les publications LinkedIn de ${clientName}. Vous pouvez les relire, les valider ou demander des modifications ici, sans créer de compte :\n${url}\n\nGardez ce lien : vous y retrouverez les prochains posts à valider.`,
      html: `<p>Bonjour,</p><p><strong>${esc(from)}</strong> prépare les publications LinkedIn de ${esc(clientName)}. Vous pouvez les relire, les valider ou demander des modifications, sans créer de compte :</p><p><a href="${url}">Voir les posts à valider</a></p><p>Gardez ce lien : vous y retrouverez les prochains posts à valider.</p>`,
    });
  } catch (e) {
    console.error("[approval] envoi e-mail échoué :", e.message);
    return false;
  }
}

// Prévient l'équipe de l'agence d'une décision du client (au mieux : n'échoue jamais)
export async function notifyAgencyOfDecision({ agencyId, clientName, approved, comment }) {
  try {
    const members = await prisma.agencyMember.findMany({ where: { agencyId }, select: { user: { select: { email: true } } } });
    const subject = approved ? `${clientName} a validé un post` : `${clientName} demande des modifications`;
    const text = approved
      ? `${clientName} a validé un post depuis son lien : il partira à la date prévue.`
      : `${clientName} demande des modifications sur un post :\n\n« ${comment} »\n\nOuvrez « À traiter » pour le corriger.`;
    for (const m of members) if (m.user?.email) await sendMail({ to: m.user.email, subject: `LinkeePost — ${subject}`, text }).catch(() => {});
  } catch (e) {
    console.error("[approval] notification agence échouée :", e.message);
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
