import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { inviteStatus, newInviteToken, normalizeEmail } from "@/lib/invites";
import { MAX_AGENCY_MEMBERS } from "@/lib/agency";

// Équipe d'une agence : jusqu'à MAX_AGENCY_MEMBERS utilisateurs (propriétaire compris). Un collaborateur est invité par
// e-mail et crée son compte avec le lien ; son accès est celui de l'agence (offre Agence, sans abonnement propre).
export const TEAM_INVITE_DAYS = 14;

export const teamInviteUrl = (token) => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/app?team=${token}`;
export const teamLinkExpiry = (from = Date.now()) => new Date(from + TEAM_INVITE_DAYS * 86400000);

// Places prises : utilisateurs + invitations encore valables
export async function seatsUsed(agencyId) {
  const [members, pending] = await Promise.all([
    prisma.agencyMember.count({ where: { agencyId } }),
    prisma.agencyInvite.count({ where: { agencyId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  return members + pending;
}

export async function createTeamInvite(agencyId, email, invitedBy) {
  email = normalizeEmail(email);
  // Une seule invitation active par adresse
  await prisma.agencyInvite.updateMany({ where: { agencyId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  return prisma.agencyInvite.create({ data: { agencyId, email, token: newInviteToken(), expiresAt: teamLinkExpiry(), invitedBy } });
}

export const teamInviteView = (i) => ({
  id: i.id, email: i.email, status: inviteStatus(i), createdAt: i.createdAt, expiresAt: i.expiresAt,
  link: inviteStatus(i) === "pending" ? teamInviteUrl(i.token) : null,
});

// Renvoie true si l'e-mail est parti ; ne lève jamais (le lien reste copiable par le propriétaire)
export async function sendTeamInviteEmail(inv, agencyName, inviterName) {
  const link = teamInviteUrl(inv.token);
  const who = inviterName ? `${inviterName} vous invite` : "Vous êtes invité(e)";
  try {
    return await sendMail({
      to: inv.email,
      subject: `LinkeePost — rejoignez l'équipe ${agencyName}`,
      text: `Bonjour,\n\n${who} à rejoindre l'équipe « ${agencyName} » sur LinkeePost pour gérer les clients de l'agence.\n\nCréez votre compte avec cette adresse e-mail (aucun abonnement à prévoir) :\n${link}\n\nCe lien est valable ${TEAM_INVITE_DAYS} jours.`,
      html: `<p>Bonjour,</p><p>${who} à rejoindre l'équipe <strong>${agencyName}</strong> sur LinkeePost pour gérer les clients de l'agence.</p><p>Créez votre compte avec cette adresse e-mail (aucun abonnement à prévoir) :</p><p><a href="${link}">Rejoindre l'équipe</a></p><p>Ce lien est valable ${TEAM_INVITE_DAYS} jours.</p>`,
    });
  } catch (e) {
    console.error("[agence] envoi e-mail d'invitation échoué :", e.message);
    return false;
  }
}

export { MAX_AGENCY_MEMBERS };
