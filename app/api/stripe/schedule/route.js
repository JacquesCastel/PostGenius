import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { cancelScheduledChange } from "@/lib/subscriptionChange";
import { syncSubscription } from "@/lib/billingSync";

export const runtime = "nodejs";

// DELETE : annule le changement d'offre programmé (l'abonnement continue avec l'offre actuelle).
// POST { action: "resume" } : reprend un abonnement résilié à l'échéance (annule la résiliation programmée).
export async function DELETE(req) {
  return handle(req, "cancel_schedule");
}
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (body.action !== "resume") return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  return handle(req, "resume");
}

async function handle(req, action) {
  if (!stripeConfigured()) return NextResponse.json({ error: "Le paiement n'est pas encore configuré." }, { status: 503 });
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true } });
  if (!user?.stripeSubscriptionId) return NextResponse.json({ error: "Aucun abonnement." }, { status: 400 });
  try {
    let sub = await stripe().subscriptions.retrieve(user.stripeSubscriptionId);
    if (action === "cancel_schedule") {
      await cancelScheduledChange(stripe(), sub);
      sub = await stripe().subscriptions.retrieve(user.stripeSubscriptionId);
    } else {
      sub = await stripe().subscriptions.update(sub.id, { cancel_at_period_end: false });
    }
    await syncSubscription(sub, user.stripeCustomerId, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Abonnement (schedule):", e?.message);
    return NextResponse.json({ error: "Opération impossible pour l'instant. Réessayez ou passez par « Gérer mon abonnement »." }, { status: 502 });
  }
}
