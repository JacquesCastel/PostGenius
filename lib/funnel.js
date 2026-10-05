// Entonnoir produit : combien de comptes ont atteint chaque étape, de
// l'inscription à l'abonnement payant. Chaque étape est comptée
// indépendamment (un client peut payer sans avoir connecté LinkedIn) et
// rapportée au nombre d'inscrits de la période.
// Exclus : admins, comptes gérés par une agence (pas d'accès à l'outil).
// days = 0 -> depuis toujours.

export const FUNNEL_STEPS = [
  { key: "signup", label: "Inscrits" },
  { key: "onboarded", label: "Onboarding terminé" },
  { key: "linkedin", label: "LinkedIn connecté" },
  { key: "drafted", label: "Premier post créé" },
  { key: "published", label: "Premier post publié" },
  { key: "paying", label: "Abonné payant" },
];

export async function computeFunnel(prisma, days = 0) {
  const envAdmins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const base = {
    role: { not: "admin" },
    managedByUserId: null,
    ...(envAdmins.length ? { email: { notIn: envAdmins } } : {}),
    ...(days > 0 ? { createdAt: { gte: new Date(Date.now() - days * 86400000) } } : {}),
  };

  const where = {
    signup: {},
    onboarded: { onboardedAt: { not: null } },
    linkedin: { linkedin: { is: { personToken: { not: null } } } },
    drafted: { drafts: { some: {} } },
    published: { drafts: { some: { status: "publié" } } },
    paying: { subscriptionStatus: "active" },
  };

  const counts = await Promise.all(
    FUNNEL_STEPS.map((s) => prisma.user.count({ where: { ...base, ...where[s.key] } }))
  );

  const total = counts[0];
  return FUNNEL_STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: counts[i],
    pct: total ? Math.round((counts[i] / total) * 1000) / 10 : 0,
  }));
}

