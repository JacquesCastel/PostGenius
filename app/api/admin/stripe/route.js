import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";

// Ventes Stripe pour l'onglet Admin > Administration : lecture directe de
// l'API Stripe (aucune dépendance au webhook, donc fiable même si
// STRIPE_WEBHOOK_SECRET n'est pas configuré).
export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configuré (STRIPE_SECRET_KEY manquant)." }, { status: 404 });
  }

  // Clé live ou de test : badge LIVE/TEST de la carte admin (renvoyé aussi en
  // cas d'erreur Stripe, pour savoir quel compte a été interrogé).
  const livemode = process.env.STRIPE_SECRET_KEY.startsWith("sk_live");

  try {
    const [subs, invoices] = await Promise.all([
      stripe().subscriptions.list({ status: "active", limit: 100, expand: ["data.customer"] }),
      stripe().invoices.list({ status: "paid", limit: 20, expand: ["data.customer"] }),
    ]);

    const since30d = Date.now() / 1000 - 30 * 86400;

    // MRR : somme des abonnements actifs, ramenés au mois (annuel ÷ 12)
    let mrr = 0;
    for (const s of subs.data) {
      for (const item of s.items.data) {
        const amount = (item.price.unit_amount ?? 0) * (item.quantity ?? 1);
        const perMonth = item.price.recurring?.interval === "year" ? amount / 12 : amount;
        mrr += perMonth;
      }
    }

    const revenue30d = invoices.data
      .filter((inv) => inv.status_transitions?.paid_at >= since30d)
      .reduce((sum, inv) => sum + (inv.amount_paid ?? 0), 0);

    const recentSales = invoices.data.map((inv) => ({
      id: inv.id,
      customerEmail: inv.customer_email || inv.customer?.email || null,
      amount: inv.amount_paid,
      currency: inv.currency,
      date: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : null,
      description: inv.lines?.data?.[0]?.description || null,
    }));

    return NextResponse.json({
      livemode,
      totals: {
        activeSubscriptions: subs.data.length,
        mrr: mrr / 100,
        revenue30d: revenue30d / 100,
      },
      recentSales,
    });
  } catch (e) {
    return NextResponse.json({ error: `Erreur Stripe : ${e.message}`, livemode }, { status: 502 });
  }
}
