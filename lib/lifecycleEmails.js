import { prisma } from "./db";
import { sendMail, isMailerConfigured } from "./mailer";
import { isAdminUser } from "./admin";
import { trialDaysLeft } from "./plans";
import { buildEmail } from "./emailLayout";
import { accountFacts, factsHtml } from "./accountFacts";

// Emails de cycle de vie : bienvenue, fin d'essai (J-3), paiement échoué.
// Envoi idempotent : LifecycleEmail(userId, key) est unique, donc un email n'est
// jamais envoyé deux fois (planificateur qui repasse, webhook Stripe rejoué).

const TRIAL_WARNING_DAYS = 3;

function base() {
  return (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function build({ subject, title, paragraphs, cta, facts = null }) {
  const f = factsHtml(facts);
  return buildEmail({ subject, title, paragraphs: f ? [...paragraphs, f] : paragraphs, cta, note: `Vous recevez cet e-mail car vous avez un compte sur ${esc(base().replace(/^https?:\/\//, ""))}.` });
}

const hello = (user) => `Bonjour${user.name ? ` ${esc(user.name)}` : ""},`;

export const templates = {
  welcome: (user, facts = null) =>
    build({
      facts,
      subject: "Bienvenue sur LinkeePost",
      title: "Bienvenue sur LinkeePost",
      paragraphs: [
        hello(user),
        "Votre compte est prêt. Quelques minutes par semaine suffisent pour garder une présence LinkedIn régulière : LinkeePost rédige, met en forme et programme vos posts.",
        "Pour démarrer, complétez votre profil et générez votre premier post.",
      ],
      cta: { label: "Ouvrir LinkeePost", url: `${base()}/app` },
    }),

  trial_ending: (user, days, facts = null) =>
    build({
      facts,
      subject: `Votre essai LinkeePost se termine dans ${days} jour${days > 1 ? "s" : ""}`,
      title: `Votre essai se termine dans ${days} jour${days > 1 ? "s" : ""}`,
      paragraphs: [
        hello(user),
        `Votre période d'essai gratuite se termine dans ${days} jour${days > 1 ? "s" : ""}. Passé ce délai, l'accès à la création et à la programmation de posts sera suspendu.`,
        "Choisissez une offre pour conserver vos posts, vos campagnes et votre charte graphique.",
      ],
      cta: { label: "Choisir mon offre", url: `${base()}/app?view=billing` },
    }),

  payment_failed: (user, facts = null) =>
    build({
      facts,
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
export async function sendOnce(user, key, mail) {
  if (!isMailerConfigured()) return false;
  try {
    await prisma.lifecycleEmail.create({ data: { userId: user.id, key } });
  } catch (e) {
    if (e.code === "P2002") return false; // déjà envoyé
    throw e;
  }
  try {
    return Boolean(await sendMail({ to: user.email, ...mail })); // false : adresse sans boîte (client d'agence), la clé reste pour ne pas réessayer
  } catch (e) {
    // Échec d'envoi : on libère la clé pour retenter au prochain passage
    await prisma.lifecycleEmail.delete({ where: { userId_key: { userId: user.id, key } } }).catch(() => {});
    console.error(`[lifecycle] envoi "${key}" à l'utilisateur ${user.id} :`, e.message);
    return false;
  }
}

const factsOf = (user) => accountFacts(user.id).catch(() => null);

export const sendWelcomeEmail = async (user) => sendOnce(user, "welcome", templates.welcome(user, await factsOf(user)));

export const sendPaymentFailedEmail = async (user, invoiceId) =>
  sendOnce(user, `payment_failed:${invoiceId}`, templates.payment_failed(user, await factsOf(user)));

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
      if (await sendOnce(u, "trial_ending", templates.trial_ending(u, days, await factsOf(u)))) sent++;
    } catch (e) {
      console.error(`[lifecycle] fin d'essai ${u.id} :`, e.message);
    }
  }
  const out = { candidates: users.length, sent };
  (globalThis.__emailRuns ??= {}).trial = { at: new Date().toISOString(), result: out };
  return out;
}
