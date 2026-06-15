import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe, planFromPriceId } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook Stripe — source de vérité de l'abonnement.
// Configurer l'endpoint sur https://VOTRE-DOMAINE/api/stripe/webhook
// et coller le "Signing secret" (whsec_...) dans STRIPE_WEBHOOK_SECRET.
export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Webhook non configuré", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const body = await req.text(); // corps BRUT requis pour la vérification de signature

  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return new NextResponse(`Signature invalide : ${e.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe().subscriptions.retrieve(session.subscription);
          await syncSubscription(sub, session.customer, session.metadata?.userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await syncSubscription(sub, sub.customer, sub.metadata?.userId);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Webhook handler error:", e?.message);
    return new NextResponse("Erreur de traitement", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Met à jour le compte à partir d'un objet abonnement Stripe.
async function syncSubscription(sub, customerId, userIdHint) {
  const priceId = sub.items?.data?.[0]?.price?.id;
  const map = planFromPriceId(priceId);

  const data = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status, // active | trialing | past_due | canceled | unpaid | incomplete
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
  };
  // On ne change le plan que tant que l'abonnement est vivant (pas annulé/impayé)
  const alive = ["active", "trialing", "past_due"].includes(sub.status);
  if (map && alive) {
    data.plan = map.plan;
    data.subscriptionInterval = map.interval;
    data.planUpdatedAt = new Date();
  }

  // Cible : par userId (metadata) si dispo, sinon par client Stripe
  const where = userIdHint ? { id: userIdHint } : { stripeCustomerId: customerId };
  await prisma.user.update({ where, data }).catch(async () => {
    // fallback : retrouver par client si l'id de metadata a échoué
    if (userIdHint && customerId) {
      await prisma.user.update({ where: { stripeCustomerId: customerId }, data }).catch(() => {});
    }
  });
}
