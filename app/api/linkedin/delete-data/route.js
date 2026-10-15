import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { parseMentions } from "@/lib/mentions";

// POST — « Supprimer mes données LinkedIn » : déconnecte LinkedIn et efface ce que LinkeePost en a conservé pour ce compte
// (jetons et identifiants, statistiques de posts, interactions, pages enregistrées pour les mentions, personnes taguées).
// Les posts écrits par l'utilisateur restent : ce sont ses contenus, pas des données LinkedIn. Dans l'espace d'un client
// d'agence, cela ne concerne que ce client.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const drafts = await prisma.draft.findMany({ where: { userId, mentions: { not: null } }, select: { id: true, mentions: true } });
  // Les mentions de personnes sont des données de membres LinkedIn ; celles de pages (choisies par l'utilisateur) sont conservées
  const withPeople = drafts.map((d) => ({ id: d.id, list: parseMentions(d.mentions) })).filter((d) => d.list.some((m) => m.urn.startsWith("urn:li:person:")));

  const [account, stats, interactions, saved] = await prisma.$transaction([
    prisma.linkedInAccount.deleteMany({ where: { userId } }),
    prisma.postPerformance.deleteMany({ where: { draft: { userId } } }),
    prisma.interactionLog.deleteMany({ where: { userId } }),
    prisma.savedMention.deleteMany({ where: { userId } }),
    ...withPeople.map((d) => {
      const kept = d.list.filter((m) => !m.urn.startsWith("urn:li:person:"));
      return prisma.draft.update({ where: { id: d.id }, data: { mentions: kept.length ? JSON.stringify(kept) : null } });
    }),
  ]);
  return NextResponse.json({ ok: true, deleted: { connections: account.count, stats: stats.count, interactions: interactions.count, savedMentions: saved.count, draftsCleaned: withPeople.length } });
}
