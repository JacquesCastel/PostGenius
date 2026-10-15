import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionData, clientAccessible } from "@/lib/session";
import { isAdminUser } from "@/lib/admin";
import { effectiveLimits } from "@/lib/quotas";

export async function GET(req) {
  const session = await getSessionData(req);
  if (!session?.userId) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, email: true, name: true, role: true, disabled: true,
      plan: true, trialEndsAt: true, subscriptionStatus: true,
      subscriptionInterval: true, currentPeriodEnd: true, stripeCustomerId: true,
      cancelAtPeriodEnd: true, scheduledPlan: true, scheduledInterval: true, scheduledAt: true,
    },
  });
  if (!user || user.disabled) return NextResponse.json({ user: null });

  // Vue support (admin en lecture seule sur un compte client) : on renvoie le
  // compte du client tel qu'il le verrait — offre, abonnement, sans droits admin.
  if (session.support && session.clientId) {
    const client = await prisma.user.findUnique({
      where: { id: session.clientId },
      select: {
        id: true, email: true, name: true, companyName: true,
        plan: true, trialEndsAt: true, subscriptionStatus: true,
        subscriptionInterval: true, currentPeriodEnd: true, stripeCustomerId: true,
      },
    });
    if (client) {
      return NextResponse.json({
        user: {
          id: client.id,
          email: client.email,
          name: client.name,
          isAdmin: false,
          isSuperAdmin: false,
          plan: client.plan,
          trialEndsAt: client.trialEndsAt,
          subscriptionStatus: client.subscriptionStatus,
          subscriptionInterval: client.subscriptionInterval,
          currentPeriodEnd: client.currentPeriodEnd,
          limits: await effectiveLimits(client.id),
          hasBilling: false, // pas d'accès au portail de facturation en vue support
          billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
        },
        impersonating: { id: client.id, name: client.name, companyName: client.companyName, email: client.email, support: true },
      });
    }
  }

  // Infos sur le client impersonné (mode agence)
  let impersonating = null;
  if (session.clientId && (await clientAccessible(session))) {
    const client = await prisma.user.findUnique({
      where: { id: session.clientId },
      select: { id: true, name: true, companyName: true, email: true },
    });
    if (client) impersonating = client;
  }

  // Limites du compte dont on voit les données : le client ouvert (mode agence), sinon le compte lui-même
  const limits = await effectiveLimits(impersonating?.id ?? user.id);

  const membership = await prisma.agencyMember.findUnique({ where: { userId: user.id }, select: { role: true } });

  return NextResponse.json({
    user: {
      id: user.id,
      agencyCollaborator: Boolean(membership && membership.role !== "owner"), // simple collaborateur : ni abonnement, ni charte de l'agence, ni création de client
      email: user.email,
      name: user.name,
      limits,
      isAdmin: isAdminUser(user),
      isSuperAdmin: user.role === "admin",
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionInterval: user.subscriptionInterval,
      currentPeriodEnd: user.currentPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      scheduledPlan: user.scheduledPlan,
      scheduledInterval: user.scheduledInterval,
      scheduledAt: user.scheduledAt,
      hasBilling: Boolean(user.stripeCustomerId),
      billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    },
    impersonating, // null si pas en mode client
  });
}
