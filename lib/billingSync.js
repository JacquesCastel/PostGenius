import { prisma } from "./db";
import { planFromPriceId } from "./stripe";

// Met à jour le compte à partir d'un objet abonnement Stripe (webhook, ou retour immédiat d'un changement d'offre).
export async function syncSubscription(sub, customerId, userIdHint) {
  const priceId = sub.items?.data?.[0]?.price?.id;
  const map = planFromPriceId(priceId);

  const data = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status, // active | trialing | past_due | canceled | unpaid | incomplete
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end), // résiliation programmée à l'échéance
  };
  // On ne change le plan que tant que l'abonnement est vivant (pas annulé/impayé)
  const alive = ["active", "trialing", "past_due"].includes(sub.status);
  if (map && alive) {
    data.plan = map.plan;
    data.subscriptionInterval = map.interval;
    data.planUpdatedAt = new Date();
  }
  // Plus de planification en cours (changement effectué, annulé, ou abonnement terminé) : on oublie le changement programmé
  // Cible : par userId (metadata) si dispo, sinon par client Stripe
  const where = userIdHint ? { id: userIdHint } : { stripeCustomerId: customerId };
  let done = !sub.schedule || !alive;
  if (!done && map) {
    // La planification existe encore pendant la dernière période : si l'offre programmée est déjà en place, le changement est fait
    const u = await prisma.user.findFirst({ where, select: { scheduledPlan: true, scheduledInterval: true } }).catch(() => null);
    done = u?.scheduledPlan === map.plan && u?.scheduledInterval === map.interval;
  }
  if (done) {
    data.scheduledPlan = null;
    data.scheduledInterval = null;
    data.scheduledAt = null;
  }

  await prisma.user.update({ where, data }).catch(async () => {
    // fallback : retrouver par client si l'id de metadata a échoué
    if (userIdHint && customerId) {
      await prisma.user.update({ where: { stripeCustomerId: customerId }, data }).catch(() => {});
    }
  });
}
