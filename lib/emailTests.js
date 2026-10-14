import { quotaMail, onboardingMail, digestSoloMail, digestAgencyMail, reminderMail, reportMail } from "./engagementEmails";
import { templates } from "./lifecycleEmails";

// Messages d'exemple pour l'administration : chacun est construit par le même code que l'envoi réel, avec des chiffres fictifs.
// Les liens de validation et de rapport sont des exemples (ils ne mènent à aucun client).
const SAMPLE_TOKEN = "0".repeat(48);

export const EMAIL_TESTS = [
  { id: "quota80", group: "Quotas", label: "Alerte de quota à 80 %", build: (u) => quotaMail(u, { n: 12, limit: 15, key: "postsPerMonth", level: 80 }) },
  { id: "quota100", group: "Quotas", label: "Quota atteint (100 %)", build: (u) => quotaMail(u, { n: 15, limit: 15, key: "postsPerMonth", level: 100 }) },
  { id: "quotaClient", group: "Quotas", label: "Quota d'un client (pour l'agence)", build: (u) => quotaMail(u, { who: "Wharf", n: 20, limit: 20, key: "postsPerMonth", level: 100, isClient: true }) },
  { id: "onb1a", group: "Accueil", label: "Jour 1 : LinkedIn non connecté", build: (u) => onboardingMail(u, "d1", { connected: false }) },
  { id: "onb1b", group: "Accueil", label: "Jour 1 : LinkedIn connecté", build: (u) => onboardingMail(u, "d1", { connected: true }) },
  { id: "onb3a", group: "Accueil", label: "Jour 3 : aucun post créé", build: (u) => onboardingMail(u, "d3", { drafts: 0 }) },
  { id: "onb3b", group: "Accueil", label: "Jour 3 : déjà des posts", build: (u) => onboardingMail(u, "d3", { drafts: 4 }) },
  { id: "onb7", group: "Accueil", label: "Jour 7 : pour aller plus loin", build: (u) => onboardingMail(u, "d7", { trialLeft: 7 }) },
  { id: "digestSolo", group: "Récapitulatif du lundi", label: "Utilisateur seul", build: (u) => digestSoloMail(u, { published: 3, scheduled: 2, toValidate: 1 }) },
  { id: "digestAgency", group: "Récapitulatif du lundi", label: "Agence (par client)", build: (u) => digestAgencyMail(u, [{ name: "Wharf", published: 3, scheduled: 2, toValidate: 1, changes: 1 }, { name: "Hermès Conseil", published: 1, scheduled: 4, toValidate: 0, changes: 0 }]) },
  { id: "reminder", group: "Envoyés aux clients de l'agence", label: "Relance de validation", build: () => reminderMail({ agency: "Votre agence", client: "Wharf", count: 2, token: SAMPLE_TOKEN }) },
  { id: "report", group: "Envoyés aux clients de l'agence", label: "Rapport du mois", build: () => reportMail({ agency: "Votre agence", client: "Wharf", month: "septembre 2026", published: 6, impressions: 4210, token: SAMPLE_TOKEN }) },
  { id: "welcome", group: "Compte et abonnement", label: "Bienvenue", build: (u) => templates.welcome(u) },
  { id: "trial", group: "Compte et abonnement", label: "Fin d'essai (3 jours)", build: (u) => templates.trial_ending(u, 3) },
  { id: "payment", group: "Compte et abonnement", label: "Paiement échoué", build: (u) => templates.payment_failed(u) },
];
