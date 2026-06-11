import nodemailer from "nodemailer";

// Envoi d'emails. Si SMTP_HOST n'est pas configuré (dev), l'email n'est pas
// envoyé : la fonction renvoie false et l'appelant affiche le lien en console.

export function isMailerConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendMail({ to, subject, text, html }) {
  if (!isMailerConfigured()) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "PostGenius <no-reply@localhost>",
    to,
    subject,
    text,
    html,
  });
  return true;
}
