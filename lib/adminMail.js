import { prisma } from "./db";
import { buildEmail } from "./emailLayout";
import { unsubscribeUrl } from "./emailPrefs";
import { agencyRecipients, clientLabel } from "./agencyNotify";
import { newLeadsMail } from "./teamEmails";
import { cleanCustom, TEMPLATES } from "./adminMailContent";

// Envoi manuel d'un e-mail à l'équipe d'un client (ou à une personne) depuis l'Administration : aperçu, puis envoi.
// Même circuit et mêmes règles que les e-mails automatiques : seuls les destinataires qui n'ont pas coupé les e-mails le reçoivent.

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hello = (u) => `Bonjour${u?.name ? ` ${esc(u.name)}` : ""},`;
const TEAM_NOTE = "Vous recevez cet e-mail car vous faites partie d'une équipe d'agence sur LinkeePost.";
const OWN_NOTE = "Vous recevez cet e-mail car vous avez un compte LinkeePost.";

// Construit le message et la liste des destinataires. Renvoie { error, status } ou { template, kind, subject, text, mail, recipients, skipped, account }.
export async function buildManualMail({ template, userId, subject, body }) {
  if (!TEMPLATES.includes(template)) return { error: "Modèle inconnu.", status: 400 };
  const account = await prisma.user.findUnique({ where: { id: String(userId ?? "") }, select: { id: true, name: true, email: true, companyName: true, agencyId: true, disabled: true } });
  if (!account) return { error: "Compte introuvable.", status: 404 };

  const ids = account.agencyId ? await agencyRecipients(account.agencyId, account.id) : [account.id];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, name: true, disabled: true, emailOptOut: true } });
  const recipients = people.filter((u) => !u.disabled && !u.emailOptOut);
  const skipped = people.length - recipients.length;
  if (!recipients.length) return { error: "Aucun destinataire : tous ont coupé les e-mails ou leur compte est suspendu.", status: 422 };
  const who = account.agencyId ? clientLabel(account) : null;

  let mail, kind, text;
  if (template === "leads") {
    // Leads issus des commentaires de la page, encore à qualifier et pas encore effacés (48 h)
    const leads = await prisma.lead.findMany({ where: { userId: account.id, source: "page_comment", status: "new", level: null, createdAt: { gte: new Date(Date.now() - 48 * 3600_000) } }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 500 });
    if (!leads.length) return { error: "Aucun lead à qualifier pour ce compte (ou tous sont déjà effacés).", status: 422 };
    mail = newLeadsMail({ client: who, clientId: account.agencyId ? account.id : null, created: leads.length, waiting: leads.length, oldestCreatedAt: leads[0].createdAt });
    kind = "equipe-leads";
  } else {
    const c = cleanCustom({ subject, body });
    if (c.error) return { error: c.error, status: 400 };
    mail = { kind: "equipe-message", subject: c.subject, eyebrow: "LinkeePost", title: c.subject, paragraphs: (u) => [hello(u), ...c.paragraphs.map((p) => esc(p).replace(/\n/g, "<br>"))] };
    kind = "equipe-message";
  }
  const first = mail.paragraphs(recipients[0]);
  text = [mail.subject, ...first.map((p) => String(p).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'))].join("\n\n");
  return { template, kind, subject: mail.subject, text, mail, recipients, skipped, account: { id: account.id, label: who ?? (account.name || account.email) }, note: account.agencyId ? TEAM_NOTE : OWN_NOTE };
}

// Message complet prêt pour sendMail, pour un destinataire
export function renderFor(built, u) {
  const { paragraphs, kind, ...rest } = built.mail;
  return { kind: built.kind, ...buildEmail({ ...rest, paragraphs: paragraphs(u), unsubscribeUrl: unsubscribeUrl(u.id), note: built.note }) };
}
