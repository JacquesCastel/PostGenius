// Les messages envoyés par l'application, avec ce qui les déclenche en production (journal d'administration)
export const EMAIL_KINDS = [
  { kind: "bienvenue", label: "Bienvenue", trigger: "À l'inscription d'un compte" },
  { kind: "accueil", label: "Accueil (jours 1, 3, 7)", trigger: "1 à 10 jours après l'inscription" },
  { kind: "fin-essai", label: "Fin d'essai", trigger: "3 jours avant la fin de l'essai" },
  { kind: "essai-termine", label: "Essai terminé", trigger: "À la fin de l'essai, sans abonnement (une seule fois)" },
  { kind: "paiement-echoue", label: "Paiement échoué", trigger: "Quand Stripe signale un échec" },
  { kind: "quota", label: "Alerte de quota", trigger: "À 80 % puis 100 % d'une limite" },
  { kind: "recapitulatif", label: "Récapitulatif de la semaine", trigger: "Le lundi, s'il y a de l'activité" },
  { kind: "validation-client", label: "Lien de validation envoyé au client", trigger: "Quand l'agence envoie le lien" },
  { kind: "relance-client", label: "Relance de validation", trigger: "Tous les 3 jours, si activée pour le client" },
  { kind: "decision-client", label: "Décision du client (équipe)", trigger: "Quand le client valide ou commente" },
  { kind: "rapport-client", label: "Rapport du mois (client)", trigger: "Du 1er au 3 du mois, si activé pour le client" },
  { kind: "invitation-equipe", label: "Invitation dans l'équipe", trigger: "Quand le propriétaire invite un collaborateur" },
  { kind: "invitation-test", label: "Invitation à tester", trigger: "Quand un administrateur invite" },
  { kind: "mot-de-passe", label: "Réinitialisation du mot de passe", trigger: "Sur demande de l'utilisateur" },
  { kind: "limite-equipe", label: "Agence à la limite d'utilisateurs (pour vous)", trigger: "Quand une agence tente d'inviter un 6ᵉ utilisateur (une fois par agence)" },
  { kind: "alerte-sauvegarde", label: "Alerte de sauvegarde", trigger: "Quand les sauvegardes sont en défaut" },
];
