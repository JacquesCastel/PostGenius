import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { buildEmail, escHtml } from "@/lib/emailLayout";
import { inviteStatus, newInviteToken, normalizeEmail } from "@/lib/invites";
import { MAX_AGENCY_MEMBERS } from "@/lib/agency";
import { isAdminUser } from "@/lib/admin";

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

export function teamInviteMail(inv, agencyName, inviterName) {
  const who = inviterName ? `${inviterName} vous invite` : "Vous êtes invité(e)";
  return buildEmail({
    subject: `LinkeePost — rejoignez l'équipe ${agencyName}`,
    eyebrow: "Invitation à l'équipe",
    title: `Rejoignez l'équipe ${agencyName}`,
    preheader: `${who} à rejoindre l'équipe « ${agencyName} » sur LinkeePost.`,
    paragraphs: [
      "Bonjour,",
      `${escHtml(who)} à rejoindre l'équipe <strong>${escHtml(agencyName)}</strong> sur LinkeePost pour gérer les clients de l'agence.`,
      "Créez votre compte avec cette adresse e-mail. Aucun abonnement à prévoir : l'accès est celui de l'agence.",
    ],
    cta: { label: "Rejoindre l'équipe", url: teamInviteUrl(inv.token) },
    note: `Ce lien est valable ${TEAM_INVITE_DAYS} jours.`,
  });
}

// Renvoie true si l'e-mail est parti ; ne lève jamais (le lien reste copiable par le propriétaire)
export async function sendTeamInviteEmail(inv, agencyName, inviterName) {
  try {
    return await sendMail({ kind: "invitation-equipe", to: inv.email, ...teamInviteMail(inv, agencyName, inviterName) });
  } catch (e) {
    console.error("[agence] envoi e-mail d'invitation échoué :", e.message);
    return false;
  }
}

// Adresse à laquelle une agence écrit pour dépasser la limite (la même que la page de contact)
export const CONTACT_EMAIL = "contact@postgenius.network";

// Message adressé aux administrateurs : une agence veut dépasser une limite de son offre (utilisateurs ou clients)
const LIMIT_WORDS = {
  seats: { subject: (n) => `limite de ${n} utilisateurs atteinte`, title: "Une agence veut ajouter un utilisateur", body: (n) => `compte ${n} utilisateurs (invitations en attente comprises) et son propriétaire`, action: "d'en inviter un de plus" },
  clients: { subject: (n) => `limite de ${n} clients atteinte`, title: "Une agence veut ajouter un client", body: (n) => `gère déjà ${n} clients et son propriétaire`, action: "d'en créer un de plus" },
};

export function seatsLimitAdminMail({ agencyName, ownerName, ownerEmail, seats, kind = "seats" }) {
  const w = LIMIT_WORDS[kind] ?? LIMIT_WORDS.seats;
  const base = (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
  const who = ownerName ? `${escHtml(ownerName)} (${escHtml(ownerEmail)})` : escHtml(ownerEmail);
  return buildEmail({
    subject: `Agence « ${agencyName} » : ${w.subject(seats)}`,
    eyebrow: "Administration",
    title: w.title,
    preheader: `${agencyName} a atteint la limite de son offre.`,
    paragraphs: [
      `L'agence <strong>${escHtml(agencyName)}</strong> ${w.body(seats)}, ${who}, vient de tenter ${w.action}.`,
      "La demande a été refusée et le propriétaire a vu le message « contactez-nous ». Répondez à cet e-mail pour le joindre directement.",
    ],
    cta: { label: "Ouvrir l'administration", url: `${base}/app` },
  });
}

// Prévient les administrateurs, une seule fois par agence et par type de limite (marqueur LifecycleEmail sur le propriétaire) ; ne lève jamais
export async function notifySeatsLimit({ agencyId, ownerId, kind = "seats", limit = MAX_AGENCY_MEMBERS }) {
  const key = kind === "clients" ? "clients_limit" : "seats_limit";
  try {
    const [owner, agency, admins] = await Promise.all([
      prisma.user.findUnique({ where: { id: ownerId }, select: { email: true, name: true } }),
      prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
      prisma.user.findMany({ where: { disabled: false }, select: { email: true, role: true } }),
    ]);
    if (!owner) return false;
    const to = admins.filter(isAdminUser).map((u) => u.email);
    if (!to.length) return false;
    try {
      await prisma.lifecycleEmail.create({ data: { userId: ownerId, key } });
    } catch (e) {
      if (e.code === "P2002") return false; // déjà prévenu
      throw e;
    }
    const mail = seatsLimitAdminMail({ agencyName: agency?.name || "Agence", ownerName: owner.name, ownerEmail: owner.email, seats: limit, kind });
    let sent = false;
    for (const email of to) {
      try { sent = Boolean(await sendMail({ kind: "limite-equipe", to: email, replyTo: owner.email, ...mail })) || sent; } catch (e) { console.error("[agence] alerte limite non envoyée :", e.message); }
    }
    // Rien n'est parti (SMTP absent ou en échec) : on libère le marqueur pour réessayer à la prochaine tentative
    if (!sent) await prisma.lifecycleEmail.delete({ where: { userId_key: { userId: ownerId, key } } }).catch(() => {});
    return sent;
  } catch (e) {
    console.error("[agence] alerte limite :", e.message);
    return false;
  }
}

export { MAX_AGENCY_MEMBERS };
