// Changement d'offre d'un abonné qui a déjà un abonnement Stripe vivant : on MODIFIE cet abonnement,
// on n'en crée jamais un second (sinon l'abonné serait facturé deux fois).
//   montée  → effet immédiat, la différence est facturée tout de suite au prorata du temps restant
//   descente → effet à la fin de la période déjà payée (planification d'abonnement Stripe)
// `stripe` est le client Stripe (injecté pour pouvoir tester avec un simulateur).

export const LIVE_STATUSES = ["active", "trialing", "past_due"];

const priceOf = (sub) => sub?.items?.data?.[0]?.price?.id;

// Applique une montée d'offre immédiate ; renvoie l'abonnement mis à jour
export async function applyUpgrade(stripe, sub, { price, userId, plan, interval }) {
  const item = sub.items.data[0];
  return stripe.subscriptions.update(sub.id, {
    items: [{ id: item.id, price }],
    proration_behavior: "always_invoice", // facture la différence maintenant
    payment_behavior: "error_if_incomplete", // si le paiement échoue, rien ne change
    cancel_at_period_end: false,
    metadata: { userId, plan, interval },
  });
}

// Programme une descente d'offre à l'échéance ; renvoie { scheduleId, effectiveAt }
export async function applyDowngrade(stripe, sub, { price }) {
  const currentPrice = priceOf(sub);
  let schedule = sub.schedule ? await stripe.subscriptionSchedules.retrieve(typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id) : null;
  if (!schedule) schedule = await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
  const phase = schedule.phases?.[0];
  if (!phase) throw new Error("Planification Stripe invalide.");
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release", // l'abonnement continue normalement avec la nouvelle offre
    phases: [
      {
        items: [{ price: currentPrice, quantity: 1 }],
        start_date: phase.start_date,
        end_date: phase.end_date,
      },
      { items: [{ price, quantity: 1 }], iterations: 1 },
    ],
  });
  return { scheduleId: schedule.id, effectiveAt: new Date(phase.end_date * 1000) };
}

// Annule un changement programmé : l'abonnement reprend son cours avec l'offre actuelle
export async function cancelScheduledChange(stripe, sub) {
  if (!sub?.schedule) return false;
  await stripe.subscriptionSchedules.release(typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id);
  return true;
}
