import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, isAdminUser } from "@/lib/admin";
import { estimateCost } from "@/lib/usage";

// Vue d'ensemble super admin : comptes + consommation IA (30 derniers jours)

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const since = new Date(Date.now() - 30 * 86400000);

  const [users, draftCounts, usage30, usageAll] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        disabled: true,
        plan: true,
        trialEndsAt: true,
        createdAt: true,
        onboardedAt: true,
        linkedin: { select: { personToken: true, orgToken: true } },
        _count: { select: { drafts: true, campaigns: true } },
      },
    }),
    prisma.draft.groupBy({ by: ["userId", "status"], _count: { _all: true } }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, images: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      _sum: { inputTokens: true, outputTokens: true, images: true },
    }),
  ]);

  const publishedBy = {};
  for (const d of draftCounts) {
    if (d.status === "publié") publishedBy[d.userId] = d._count._all;
  }
  const u30 = Object.fromEntries(usage30.map((u) => [u.userId, u._sum]));
  const uAll = Object.fromEntries(usageAll.map((u) => [u.userId, u._sum]));

  const rows = users.map((u) => {
    const s30 = u30[u.id] ?? {};
    const sAll = uAll[u.id] ?? {};
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: isAdminUser(u),
      disabled: u.disabled,
      plan: u.plan,
      trialEndsAt: u.trialEndsAt,
      createdAt: u.createdAt,
      onboarded: Boolean(u.onboardedAt),
      linkedinConnected: Boolean(u.linkedin?.personToken),
      orgConnected: Boolean(u.linkedin?.orgToken),
      posts: u._count.drafts,
      published: publishedBy[u.id] ?? 0,
      campaigns: u._count.campaigns,
      usage30: {
        inputTokens: s30.inputTokens ?? 0,
        outputTokens: s30.outputTokens ?? 0,
        images: s30.images ?? 0,
        cost: estimateCost({
          inputTokens: s30.inputTokens ?? 0,
          outputTokens: s30.outputTokens ?? 0,
          images: s30.images ?? 0,
        }),
      },
      usageTotal: {
        inputTokens: sAll.inputTokens ?? 0,
        outputTokens: sAll.outputTokens ?? 0,
        images: sAll.images ?? 0,
        cost: estimateCost({
          inputTokens: sAll.inputTokens ?? 0,
          outputTokens: sAll.outputTokens ?? 0,
          images: sAll.images ?? 0,
        }),
      },
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      users: acc.users + 1,
      published: acc.published + r.published,
      inputTokens30: acc.inputTokens30 + r.usage30.inputTokens,
      outputTokens30: acc.outputTokens30 + r.usage30.outputTokens,
      images30: acc.images30 + r.usage30.images,
      cost30: acc.cost30 + r.usage30.cost,
    }),
    { users: 0, published: 0, inputTokens30: 0, outputTokens30: 0, images30: 0, cost30: 0 }
  );

  return NextResponse.json({ totals, users: rows });
}
