import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { stripe, stripeConfigured, appUrl } from "@/lib/stripe";

export const runtime = "nodejs";

// Ouvre le portail client Stripe (gérer/annuler l'abonnement, factures, moyen de paiement).
export async function POST(req) {
  if (!stripeConfigured())
    return NextResponse.json({ error: "Le paiement n'est pas encore configuré." }, { status: 503 });

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId)
    return NextResponse.json({ error: "Aucun abonnement à gérer." }, { status: 400 });

  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl()}/app?view=billing`,
  });

  return NextResponse.json({ url: session.url });
}
