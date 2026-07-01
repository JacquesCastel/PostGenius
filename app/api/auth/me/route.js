import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionData } from "@/lib/session";
import { isAdminUser } from "@/lib/admin";

export async function GET(req) {
  const session = await getSessionData(req);
  if (!session?.userId) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, email: true, name: true, role: true, disabled: true,
      plan: true, trialEndsAt: true, subscriptionStatus: true,
      subscriptionInterval: true, currentPeriodEnd: true, stripeCustomerId: true,
    },
  });
  if (!user || user.disabled) return NextResponse.json({ user: null });

  // Infos sur le client impersonné (mode agence)
  let impersonating = null;
  if (session.clientId) {
    const client = await prisma.user.findUnique({
      where: { id: session.clientId },
      select: { id: true, name: true, companyName: true, email: true },
    });
    if (client) impersonating = client;
  }

  return NextResponse.json({
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
      billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    },
    impersonating, // null si pas en mode client
  });
}
