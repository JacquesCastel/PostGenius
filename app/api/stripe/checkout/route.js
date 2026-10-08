import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { stripe, stripeConfigured, priceIdFor, appUrl } from "@/lib/stripe";
import { isPlanId, changeKind } from "@/lib/plans";
import { planFromPriceId } from "@/lib/stripe";
import { LIVE_STATUSES, applyUpgrade, applyDowngrade, cancelScheduledChange } from "@/lib/subscriptionChange";
import { syncSubscription } from "@/lib/billingSync";

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
    select: { id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true, subscriptionStatus: true },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  // Déjà abonné : on modifie l'abonnement existant, on n'en crée jamais un second
  if (user.stripeSubscriptionId && LIVE_STATUSES.includes(user.subscriptionStatus || "")) {
    let sub = null;
    try {
      sub = await stripe().subscriptions.retrieve(user.stripeSubscriptionId);
    } catch {}
    if (sub && LIVE_STATUSES.includes(sub.status)) {
      const current = planFromPriceId(sub.items?.data?.[0]?.price?.id);
      if (!current) return NextResponse.json({ error: "Votre abonnement actuel n'est pas reconnu : gérez-le depuis « Moyen de paiement et factures »." }, { status: 409 });
      const kind = changeKind(current, { plan, interval: interval === "year" ? "year" : "month" });
      if (kind === "same" && !sub.cancel_at_period_end && !sub.schedule) return NextResponse.json({ error: "C'est déjà votre offre." }, { status: 400 });
      if (sub.status === "past_due") return NextResponse.json({ error: "Régularisez d'abord votre paiement (« Moyen de paiement et factures »), puis changez d'offre.", code: "past_due" }, { status: 409 });
      const target = { price, userId: user.id, plan, interval: interval === "year" ? "year" : "month" };
      try {
        if (kind === "downgrade") {
          if (sub.cancel_at_period_end) return NextResponse.json({ error: "Votre abonnement est résilié à l'échéance : reprenez-le d'abord, puis changez d'offre.", code: "canceling" }, { status: 409 });
          const { effectiveAt } = await applyDowngrade(stripe(), sub, target);
          await prisma.user.update({ where: { id: user.id }, data: { scheduledPlan: plan, scheduledInterval: target.interval, scheduledAt: effectiveAt } });
          return NextResponse.json({ scheduled: true, kind, plan, interval: target.interval, at: effectiveAt });
        }
        // Montée (ou reprise de l'offre actuelle) : une planification en cours ne permet pas de modifier l'abonnement directement
        if (sub.schedule) await cancelScheduledChange(stripe(), sub);
        const fresh = kind === "same" ? await stripe().subscriptions.update(sub.id, { cancel_at_period_end: false }) : await applyUpgrade(stripe(), sub, target);
        await syncSubscription(fresh, user.stripeCustomerId, user.id);
        return NextResponse.json({ changed: true, kind, plan, interval: target.interval });
      } catch (e) {
        console.error("Changement d'offre:", e?.message);
        return NextResponse.json({ error: "Le changement d'offre n'a pas pu être effectué (paiement refusé ?). Votre abonnement actuel est inchangé." }, { status: 402 });
      }
    }
  }

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

  // ui_mode, origin_context et integration_identifier : validés en mode test avec
  // le SDK 17.7.0 et l'API forcée 2024-06-20 (lib/stripe.js). Sur les versions
  // d'API récentes, "hosted" s'appelle "hosted_page" : à renommer si on monte de version.
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    ui_mode: "hosted",
    origin_context: "web",
    // Libellé fixe pour suivre ce parcours dans le Dashboard (suffixe aléatoire recommandé par Stripe)
    integration_identifier: "postgenius-abonnement-aonvqlfv",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, plan, interval },
    subscription_data: { metadata: { userId: user.id, plan, interval } },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    submit_type: "auto",
    locale: "fr",
    success_url: `${appUrl()}/app?billing=success`,
    cancel_url: `${appUrl()}/app?billing=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
