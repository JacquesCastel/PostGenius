import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { postsLimit, imagesLimit, knowledgeLimit, planOf } from "@/lib/plans";

// Consommation du mois de l'offre du compte connecté (même décompte que les limites appliquées dans lib/gating.js).
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [posts, images, sources, clients] = await Promise.all([
    prisma.draft.count({ where: { userId, createdAt: { gte: monthStart } } }),
    prisma.usageEvent.aggregate({ where: { userId, kind: "image", createdAt: { gte: monthStart } }, _sum: { images: true } }),
    prisma.knowledgeSource.count({ where: { userId } }),
    user.plan === "agence" ? prisma.user.count({ where: { managedByUserId: userId } }) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    posts: { used: posts, limit: postsLimit(user) }, // limit nul = illimité
    images: { used: images._sum.images ?? 0, limit: imagesLimit(user) },
    sources: { used: sources, limit: knowledgeLimit(user), perClient: planOf(user).id === "agence" },
    clients,
    resetAt: nextReset,
  });
}
