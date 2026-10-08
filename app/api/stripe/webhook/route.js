import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billingSync";
import { LIVE_STATUSES } from "@/lib/subscriptionChange";
import { sendPaymentFailedEmail } from "@/lib/lifecycleEmails";

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
          await cancelReplacedSubscriptions(session.customer, sub.id);
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
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const user = invoice.customer
          ? await prisma.user.findUnique({
              where: { stripeCustomerId: invoice.customer },
              select: { id: true, email: true, name: true },
            })
          : null;
        if (user) await sendPaymentFailedEmail(user, invoice.id);
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

// Un nouvel abonnement remplace les précédents : on résilie les autres abonnements vivants du même client,
// pour qu'un abonné ne soit jamais facturé deux fois (ancienne fenêtre de paiement restée ouverte, par exemple).
async function cancelReplacedSubscriptions(customerId, keepId) {
  if (!customerId) return;
  try {
    const { data } = await stripe().subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    for (const other of data) {
      if (other.id === keepId || !LIVE_STATUSES.includes(other.status)) continue;
      await stripe().subscriptions.cancel(other.id, { prorate: true }); // le temps non utilisé est crédité au client
      console.warn(`[stripe] abonnement ${other.id} résilié : remplacé par ${keepId} (client ${customerId})`);
    }
  } catch (e) {
    console.error("Résiliation des abonnements remplacés impossible:", e?.message);
  }
}
