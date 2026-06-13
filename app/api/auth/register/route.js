import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isPlanId, DEFAULT_PLAN, TRIAL_DAYS } from "@/lib/plans";

export async function POST(req) {
  if (!rateLimit(`register:${clientIp(req)}`, { limit: 5, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
  }
  const { email, password, name, plan } = await req.json();

  if (!email?.includes("@") || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email valide et mot de passe d'au moins 8 caractères requis." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const chosenPlan = isPlanId(plan) ? plan : DEFAULT_PLAN;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 12),
      name: name?.trim() || null,
      plan: chosenPlan,
      trialEndsAt,
      planUpdatedAt: new Date(),
    },
  });

  const res = NextResponse.json({ user: { email: user.email, name: user.name } });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), sessionCookieOptions());
  return res;
}
