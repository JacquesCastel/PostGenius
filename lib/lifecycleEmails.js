import { prisma } from "./db";
import { sendMail, isMailerConfigured } from "./mailer";
import { isAdminUser } from "./admin";
import { trialDaysLeft } from "./plans";

// Emails de cycle de vie : bienvenue, fin d'essai (J-3), paiement échoué.
// Envoi idempotent : LifecycleEmail(userId, key) est unique, donc un email n'est
// jamais envoyé deux fois (planificateur qui repasse, webhook Stripe rejoué).

const TRIAL_WARNING_DAYS = 3;

function base() {
  return (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function layout({ title, paragraphs, cta }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0"><a href="${cta.url}" style="background:#ff5a5f;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b2a4a;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:18px;font-weight:700;margin:0 0 18px">${esc(title)}</p>${body}${button}
<p style="font-size:12px;color:#8a97ad;margin:26px 0 0">LinkeePost — vous recevez cet email car vous avez un compte sur ${esc(base().replace(/^https?:\/\//, ""))}.</p></div>`;
}

const plain = (paragraphs, cta) =>
  [...paragraphs.map((p) => p.replace(/<[^>]+>/g, "")), cta ? `${cta.label} : ${cta.url}` : ""].filter(Boolean).join("\n\n");

function build({ subject, title, paragraphs, cta }) {
  return { subject, html: layout({ title, paragraphs, cta }), text: plain(paragraphs, cta) };
}

const hello = (user) => `Bonjour${user.name ? ` ${esc(user.name)}` : ""},`;

const templates = {
  welcome: (user) =>
    build({
      subject: "Bienvenue sur LinkeePost",
      title: "Bienvenue sur LinkeePost",
      paragraphs: [
        hello(user),
        "Votre compte est prêt. Quelques minutes par semaine suffisent pour garder une présence LinkedIn régulière : LinkeePost rédige, met en forme et programme vos posts.",
        "Pour démarrer, complétez votre profil et générez votre premier post.",
      ],
      cta: { label: "Ouvrir LinkeePost", url: `${base()}/app` },
    }),

  trial_ending: (user, days) =>
    build({
      subject: `Votre essai LinkeePost se termine dans ${days} jour${days > 1 ? "s" : ""}`,
      title: `Votre essai se termine dans ${days} jour${days > 1 ? "s" : ""}`,
      paragraphs: [
        hello(user),
        `Votre période d'essai gratuite se termine dans ${days} jour${days > 1 ? "s" : ""}. Passé ce délai, l'accès à la création et à la programmation de posts sera suspendu.`,
        "Choisissez une offre pour conserver vos posts, vos campagnes et votre charte graphique.",
      ],
      cta: { label: "Choisir mon offre", url: `${base()}/app?view=billing` },
    }),

  payment_failed: (user) =>
    build({
      subject: "Le paiement de votre abonnement LinkeePost a échoué",
      title: "Le paiement de votre abonnement a échoué",
      paragraphs: [
        hello(user),
        "Nous n'avons pas pu prélever le paiement de votre abonnement LinkeePost. Votre accès est maintenu le temps de régulariser.",
        "Mettez à jour votre moyen de paiement pour éviter toute interruption.",
      ],
      cta: { label: "Mettre à jour mon paiement", url: `${base()}/app?view=billing` },
    }),
};

// Envoie l'email une seule fois pour (utilisateur, key). Renvoie true si envoyé.
// Sans SMTP configuré, rien n'est enregistré : l'email partira dès que ce sera le cas.
async function sendOnce(user, key, mail) {
  if (!isMailerConfigured()) return false;
  try {
    await prisma.lifecycleEmail.create({ data: { userId: user.id, key } });
  } catch (e) {
    if (e.code === "P2002") return false; // déjà envoyé
    throw e;
  }
  try {
    await sendMail({ to: user.email, ...mail });
    return true;
  } catch (e) {
    // Échec d'envoi : on libère la clé pour retenter au prochain passage
    await prisma.lifecycleEmail.delete({ where: { userId_key: { userId: user.id, key } } }).catch(() => {});
    console.error(`[lifecycle] envoi "${key}" à l'utilisateur ${user.id} :`, e.message);
    return false;
  }
}

export const sendWelcomeEmail = (user) => sendOnce(user, "welcome", templates.welcome(user));

export const sendPaymentFailedEmail = (user, invoiceId) =>
  sendOnce(user, `payment_failed:${invoiceId}`, templates.payment_failed(user));

// Planificateur : prévient les comptes dont l'essai se termine dans 3 jours ou moins.
let lastRun = 0;
export async function runTrialEndingEmails() {
  if (Date.now() - lastRun < 60 * 60 * 1000) return { skipped: true };
  lastRun = Date.now();

  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      disabled: false,
      agencyId: null, // clients gérés par une agence : pas de mail direct
      trialEndsAt: { gt: now, lte: new Date(now.getTime() + TRIAL_WARNING_DAYS * 86400000) },
      OR: [{ subscriptionStatus: null }, { subscriptionStatus: { notIn: ["active", "trialing"] } }],
    },
    select: { id: true, email: true, name: true, role: true, trialEndsAt: true },
    take: 200,
  });

  let sent = 0;
  for (const u of users) {
    if (isAdminUser(u)) continue;
    const days = trialDaysLeft(u);
    if (!days) continue;
    try {
      if (await sendOnce(u, "trial_ending", templates.trial_ending(u, days))) sent++;
    } catch (e) {
      console.error(`[lifecycle] fin d'essai ${u.id} :`, e.message);
    }
  }
  return { candidates: users.length, sent };
}
