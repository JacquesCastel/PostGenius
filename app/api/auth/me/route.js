import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { isAdminUser } from "@/lib/admin";

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      plan: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      subscriptionInterval: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  });
  if (!user || user.disabled) return NextResponse.json({ user: null });
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
  });
}
