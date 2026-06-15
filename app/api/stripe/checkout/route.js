import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { stripe, stripeConfigured, priceIdFor, appUrl } from "@/lib/stripe";
import { isPlanId } from "@/lib/plans";

export const runtime = "nodejs";

// Crée une session Stripe Checkout (abonnement) et renvoie l'URL de paiement.
export async function POST(req) {
  if (!stripeConfigured())
    return NextResponse.json({ error: "Le paiement n'est pas encore configuré." }, { status: 503 });

  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { plan, interval = "month" } = await req.json();
  if (!isPlanId(plan)) return NextResponse.json({ error: "Offre inconnue." }, { status: 400 });

  const price = priceIdFor(plan, interval);
  if (!price) return NextResponse.json({ error: "Tarif indisponible pour cette offre." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  // Réutilise le client Stripe existant, sinon le crée
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, plan, interval },
    subscription_data: { metadata: { userId: user.id, plan, interval } },
    allow_promotion_codes: true,
    locale: "fr",
    success_url: `${appUrl()}/app?billing=success`,
    cancel_url: `${appUrl()}/app?billing=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
