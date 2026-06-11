import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendMail, isMailerConfigured } from "@/lib/mailer";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Demande de réinitialisation : génère un token (1 h, usage unique) et envoie
// le lien par email. Réponse identique que le compte existe ou non
// (évite l'énumération d'emails).

export async function POST(req) {
  if (!rateLimit(`forgot:${clientIp(req)}`, { limit: 5, windowMs: 15 * 60_000 })) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
  }
  const { email } = await req.json();
  const genericResponse = NextResponse.json({
    ok: true,
    message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
  });

  if (!email?.includes("@")) return genericResponse;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return genericResponse;

  // Invalide les anciens tokens puis crée le nouveau
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const link = `${appUrl}/reset-password?token=${token}`;

  const sent = await sendMail({
    to: user.email,
    subject: "PostGenius — Réinitialisation de votre mot de passe",
    text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `<p>Bonjour,</p><p>Pour choisir un nouveau mot de passe, cliquez sur ce lien (valable 1 heure) :</p><p><a href="${link}">Réinitialiser mon mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
  });

  if (!sent) {
    // Dev sans SMTP : le lien est affiché dans le terminal du serveur
    console.log("\n========================================");
    console.log("SMTP non configuré — lien de réinitialisation :");
    console.log(link);
    console.log("========================================\n");
  }

  return genericResponse;
}
