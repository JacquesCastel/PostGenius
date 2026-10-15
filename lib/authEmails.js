import { buildEmail } from "./emailLayout";

// Message de réinitialisation du mot de passe (le même pour l'envoi réel et pour les tests de l'administration)
export const resetMail = (link) => buildEmail({
  subject: "LinkeePost — Réinitialisation de votre mot de passe",
  eyebrow: "Sécurité",
  title: "Choisissez un nouveau mot de passe",
  preheader: "Votre lien de réinitialisation est valable 1 heure.",
  paragraphs: ["Bonjour,", "Vous avez demandé à réinitialiser votre mot de passe. Le lien ci-dessous est valable <strong>1 heure</strong>.", "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé."],
  cta: { label: "Choisir un nouveau mot de passe", url: link },
});
