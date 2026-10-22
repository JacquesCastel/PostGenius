// Adresse de contact de LinkeePost : boîte lue par une personne. Elle reçoit les messages du formulaire de contact
// et sert d'adresse de réponse (Reply-To) aux e-mails envoyés par l'application. Surchargeable par CONTACT_EMAIL (.env).
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@postgenius.network";
