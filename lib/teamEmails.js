import { prisma } from "./db";
import { sendMail } from "./mailer";
import { buildEmail } from "./emailLayout";
import { unsubscribeUrl } from "./emailPrefs";
import { checkAccess } from "./gating";
import { sendOnce } from "./lifecycleEmails";

// E-mails de l'équipe d'agence : client affecté, nouveau membre, erreur de publication (un par événement, en plus de la cloche)
// et récapitulatif quotidien des posts à traiter. Ils respectent la désinscription (User.emailOptOut) et portent le lien en un clic.

const base = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hello = (u) => `Bonjour${u?.name ? ` ${esc(u.name)}` : ""},`;
const NOTE = "Vous recevez cet e-mail car vous faites partie d'une équipe d'agence sur LinkeePost.";

// Contenus : `paragraphs` reçoit le destinataire ({ name }) pour la formule d'appel
export const assignedMail = (client) => ({
  kind: "equipe-affectation",
  subject: `Un client vous est affecté : ${client}`,
  eyebrow: "Équipe de l'agence",
  title: `${client} vous est affecté`,
  paragraphs: (u) => [hello(u), `Le propriétaire de l'agence vient de vous confier <strong>${esc(client)}</strong>. Le client apparaît dans « Mes clients » : vous pouvez préparer et suivre ses posts.`],
  cta: { label: "Ouvrir mes clients", url: `${base()}/app?view=clients` },
});

export const memberJoinedMail = (member) => ({
  kind: "equipe-nouveau-membre",
  subject: `${member} a rejoint votre équipe`,
  eyebrow: "Équipe de l'agence",
  title: `${member} a rejoint votre équipe`,
  paragraphs: (u) => [hello(u), `<strong>${esc(member)}</strong> vient de créer son compte à partir de votre invitation.`, "Affectez-lui les clients dont il s'occupera : tant qu'aucun client ne lui est affecté, il n'a rien à gérer."],
  cta: { label: "Affecter des clients", url: `${base()}/app?view=team` },
});

export const publishErrorMail = (client, error) => ({
  kind: "equipe-erreur-publication",
  subject: `Publication échouée pour ${client}`,
  eyebrow: "Publication LinkedIn",
  title: `Publication échouée pour ${client}`,
  paragraphs: (u) => [hello(u), `Un post de <strong>${esc(client)}</strong> n'a pas pu partir sur LinkedIn :`, `<em>${esc(String(error ?? "").slice(0, 300))}</em>`, "Ouvrez « À traiter » pour le corriger et le reprogrammer."],
  cta: { label: "Ouvrir « À traiter »", url: `${base()}/app?view=queue` },
});

export const pageCommentMail = ({ client, clientId, comments, mentions }) => {
  const parts = [comments && `${comments} nouveau${comments > 1 ? "x" : ""} commentaire${comments > 1 ? "s" : ""}`, mentions && `${mentions} mention${mentions > 1 ? "s" : ""}`].filter(Boolean).join(" et ");
  return {
    kind: "equipe-commentaire-page",
    subject: `${parts[0].toUpperCase()}${parts.slice(1)} sur la page de ${client}`,
    eyebrow: "Page LinkedIn",
    title: `${parts} sur la page de ${client}`,
    paragraphs: (u) => [hello(u), `Il y a du nouveau sur la page LinkedIn de <strong>${esc(client)}</strong> : ${esc(parts)}.`, "Répondre vite à un commentaire fait vivre un post : vous pouvez le faire depuis « Interagir »."],
    cta: { label: "Répondre depuis Interagir", url: clientId ? `${base()}/app?client=${encodeURIComponent(clientId)}&view=engage` : `${base()}/app?view=engage` },
  };
};

// Page de l'utilisateur lui-même (pas un client d'agence) : même message, adressé à lui seul
export const ownPageCommentMail = ({ comments, mentions, user }) => {
  const m = pageCommentMail({ client: "votre page", clientId: null, comments, mentions });
  const { paragraphs, kind, ...rest } = m;
  return { kind, ...buildEmail({ ...rest, paragraphs: paragraphs(user), unsubscribeUrl: unsubscribeUrl(user.id), note: "Vous recevez cet e-mail car vous avez connecté votre page LinkedIn à LinkeePost." }) };
};

// Envoie le même message aux destinataires qui n'ont pas coupé les e-mails ; n'échoue jamais
export async function sendTeamMails(userIds, mail) {
  try {
    const users = await prisma.user.findMany({ where: { id: { in: userIds }, disabled: false, emailOptOut: false }, select: { id: true, email: true, name: true } });
    for (const u of users) {
      const { paragraphs, kind, ...rest } = mail;
      await sendMail({ kind, to: u.email, ...buildEmail({ ...rest, paragraphs: paragraphs(u), unsubscribeUrl: unsubscribeUrl(u.id), note: NOTE }) }).catch((e) => console.error(`[team-mail] ${kind} :`, e.message));
    }
  } catch (e) {
    console.error("[team-mail] échec :", e.message);
  }
}

// ── Récapitulatif quotidien ──
// Chaque jour ouvré à partir de 8 h (heure de Paris), chaque membre reçoit ce qui l'attend sur SES clients : posts à valider, modifications
// demandées par les clients, erreurs de publication. Rien à traiter → pas d'e-mail. Une fois par jour et par personne (LifecycleEmail).
function parisNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour) % 24, weekend: /^(sam|dim)/i.test(parts.weekday), day: `${parts.year}-${parts.month}-${parts.day}` };
}

export function digestMail(user, lines) {
  const toValidate = lines.reduce((n, l) => n + l.toValidate, 0);
  const feedback = lines.reduce((n, l) => n + l.feedback, 0);
  const errors = lines.reduce((n, l) => n + l.errors, 0);
  const bits = [toValidate && `${toValidate} à valider`, feedback && `${feedback} modification${feedback > 1 ? "s" : ""} demandée${feedback > 1 ? "s" : ""}`, errors && `${errors} en erreur`].filter(Boolean);
  const rows = lines.slice(0, 10).map((l) => `• <strong>${esc(l.name)}</strong> : ${[l.toValidate && `${l.toValidate} à valider`, l.feedback && `${l.feedback} modification${l.feedback > 1 ? "s" : ""} demandée${l.feedback > 1 ? "s" : ""}`, l.errors && `${l.errors} en erreur`].filter(Boolean).join(", ")}`);
  return buildEmail({
    subject: `Votre journée : ${bits.join(", ")}`,
    eyebrow: "Récapitulatif quotidien",
    title: `${bits.join(", ")}`,
    paragraphs: [hello(user), "Voici ce qui vous attend sur vos clients :", rows.join("<br>") + (lines.length > 10 ? `<br>… et ${lines.length - 10} autre${lines.length - 10 > 1 ? "s" : ""} client${lines.length - 10 > 1 ? "s" : ""}.` : "")],
    cta: { label: "Ouvrir « À traiter »", url: `${base()}/app?view=queue` },
    unsubscribeUrl: unsubscribeUrl(user.id),
    note: NOTE,
  });
}

let lastRun = 0;
export async function runTeamDigest() {
  if (Date.now() - lastRun < 30 * 60 * 1000) return { skipped: true };
  lastRun = Date.now();
  const now = parisNow();
  if (now.weekend || now.hour < 8) return { skipped: true };

  const agencies = await prisma.agency.findMany({
    select: { id: true, restrictClients: true, members: { select: { role: true, user: { select: { id: true, name: true, email: true, disabled: true, emailOptOut: true } } } } },
    take: 500,
  });
  let sent = 0;
  for (const ag of agencies) {
    const clients = await prisma.user.findMany({ where: { agencyId: ag.id }, select: { id: true, name: true, companyName: true, accessAsClient: { select: { memberId: true } } } });
    if (!clients.length) continue;
    const drafts = await prisma.draft.findMany({ where: { userId: { in: clients.map((c) => c.id) }, status: { in: ["à valider", "erreur"] } }, select: { userId: true, status: true, clientFeedback: true } });
    const stat = new Map();
    for (const d of drafts) {
      const s = stat.get(d.userId) ?? { toValidate: 0, feedback: 0, errors: 0 };
      if (d.status === "erreur") s.errors++;
      else if (d.clientFeedback) s.feedback++;
      else s.toValidate++;
      stat.set(d.userId, s);
    }
    for (const m of ag.members) {
      const u = m.user;
      if (!u || u.disabled || u.emailOptOut) continue;
      const visible = clients.filter((c) => m.role === "owner" || !ag.restrictClients || c.accessAsClient.some((a) => a.memberId === u.id));
      const lines = visible.map((c) => ({ name: c.companyName || c.name, ...(stat.get(c.id) ?? { toValidate: 0, feedback: 0, errors: 0 }) })).filter((l) => l.toValidate + l.feedback + l.errors > 0);
      if (!lines.length) continue;
      try {
        if (!(await checkAccess(u.id)).ok) continue; // agence sans accès : on ne relance pas
        if (await sendOnce(u, `team_digest:${now.day}`, { ...digestMail(u, lines), kind: "equipe-recap-quotidien" })) sent++;
      } catch (e) {
        console.error(`[team-digest] ${u.id} :`, e.message);
      }
    }
  }
  return { sent };
}
