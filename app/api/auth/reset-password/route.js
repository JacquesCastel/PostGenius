import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// Réinitialisation effective : vérifie le token, change le mot de passe,
// invalide le token et connecte l'utilisateur.

export async function POST(req) {
  const { token, password } = await req.json();

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Token et mot de passe d'au moins 8 caractères requis." },
      { status: 400 }
    );
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Lien invalide ou expiré. Refaites une demande de réinitialisation." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { password: await bcrypt.hash(password, 12) },
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Connexion automatique après réinitialisation
  const res = NextResponse.json({ user: { email: reset.user.email, name: reset.user.name } });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(reset.userId), sessionCookieOptions());
  return res;
}
