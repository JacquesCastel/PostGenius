import { buildEmail, escHtml } from "./emailLayout";

// Message de réinitialisation du mot de passe (le même pour l'envoi réel et pour les tests de l'administration)
export const resetMail = (link) => buildEmail({
  subject: "LinkeePost — Réinitialisation de votre mot de passe",
  eyebrow: "Sécurité",
  title: "Choisissez un nouveau mot de passe",
  preheader: "Votre lien de réinitialisation est valable 1 heure.",
  paragraphs: ["Bonjour,", "Vous avez demandé à réinitialiser votre mot de passe. Le lien ci-dessous est valable <strong>1 heure</strong>.", "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé."],
  cta: { label: "Choisir un nouveau mot de passe", url: link },
});

// Confirmation envoyée quand un assistant (claude.ai…) est connecté au compte par OAuth : filet de sécurité si la personne n'y est pour rien
export const assistantConnectedMail = ({ assistant, account, write, when }) => {
  const app = (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
  const date = new Date(when).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
  return buildEmail({
    subject: "LinkeePost — Un assistant a été connecté à votre compte",
    eyebrow: "Sécurité",
    title: `${assistant} a été connecté à votre compte`,
    preheader: "Ce n'était pas vous ? Retirez l'accès en un clic.",
    paragraphs: [
      "Bonjour,",
      `L'assistant <strong>${escHtml(assistant)}</strong> a été autorisé le ${date}${account ? ` sur le compte <strong>${escHtml(account)}</strong>` : ""}. Il peut lire vos posts, votre planning, vos résultats et les conseils du coach${write ? ", et créer des brouillons et des sources" : ""}. Il ne peut ni programmer ni publier.`,
      "Si ce n'était pas vous, retirez cet accès maintenant : l'assistant perd l'accès immédiatement.",
    ],
    cta: { label: "Voir mes assistants connectés", url: `${app}/app?view=profile` },
  });
};
