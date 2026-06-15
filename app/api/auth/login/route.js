import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isAdminUser } from "@/lib/admin";

export async function POST(req) {
  if (!rateLimit(`login:${clientIp(req)}`, { limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
  }
  const { email, password } = await req.json();

  const user = await prisma.user.findUnique({ where: { email: (email ?? "").toLowerCase() } });
  // Message identique que l'email existe ou non (évite l'énumération de comptes)
  if (!user || !(await bcrypt.compare(password ?? "", user.password))) {
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }
  if (user.disabled) {
    return NextResponse.json({ error: "Ce compte a été suspendu. Contactez le support." }, { status: 403 });
  }

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: isAdminUser(user),
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionInterval: user.subscriptionInterval,
      currentPeriodEnd: user.currentPeriodEnd,
      hasBilling: Boolean(user.stripeCustomerId),
    },
  });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), sessionCookieOptions());
  return res;
}
