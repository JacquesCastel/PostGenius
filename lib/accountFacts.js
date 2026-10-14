import { prisma } from "./db";
import { PLANS, trialDaysLeft } from "./plans";
import { quotaStatus, QUOTA_KEYS, QUOTA_LABELS } from "./quotas";

// Photo réelle d'un compte (offre, essai, posts, quotas) pour enrichir les e-mails : les mêmes chiffres que l'écran « Abonnement ».
export async function accountFacts(userId) {
  const now = new Date();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, trialEndsAt: true, subscriptionStatus: true } });
  if (!u) return null;
  const [total, published, scheduled, toValidate, quotas] = await Promise.all([
    prisma.draft.count({ where: { userId } }),
    prisma.draft.count({ where: { userId, status: "publié" } }),
    prisma.draft.count({ where: { userId, status: "programmé", scheduledAt: { gte: now } } }),
    prisma.draft.count({ where: { userId, status: "à valider" } }),
    quotaStatus(userId),
  ]);
  const subscribed = ["active", "trialing"].includes(u.subscriptionStatus);
  return {
    planName: PLANS[u.plan]?.name ?? PLANS.pro.name,
    trialLeft: subscribed ? null : trialDaysLeft(u) || null,
    posts: { total, published, scheduled, toValidate },
    quotas: QUOTA_KEYS.map((k) => ({ key: k, n: quotas.usage[k], limit: quotas.limits[k] })),
  };
}

const s = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// Bloc HTML « Votre compte aujourd'hui »
export function factsHtml(f) {
  if (!f) return null;
  const { posts: p } = f;
  const lines = [
    `Offre : ${f.planName}${f.trialLeft ? ` · essai gratuit : ${s(f.trialLeft, "jour restant", "jours restants")}` : ""}`,
    `Posts : ${p.total} créé${p.total > 1 ? "s" : ""} au total · ${p.published} publié${p.published > 1 ? "s" : ""} · ${p.scheduled} programmé${p.scheduled > 1 ? "s" : ""}${p.toValidate ? ` · ${p.toValidate} à valider` : ""}`,
    ...f.quotas.map(({ key, n, limit }) => `${QUOTA_LABELS[key]} : ${limit == null ? `${n} · illimité` : `${n} sur ${limit} (${Math.min(100, Math.round((n / limit) * 100))} %)`}`),
  ];
  return `<strong>Votre compte aujourd'hui</strong><br>${lines.join("<br>")}`;
}

// Extrait lisible d'un post pour une liste
export const excerpt = (text, n = 90) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
