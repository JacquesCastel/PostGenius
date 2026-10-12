import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { findApprovalLink } from "@/lib/approval";

// Public : les posts « à valider » d'un client, derrière son lien secret
export async function GET(req, { params }) {
  if (!rateLimit(`approve:${clientIp(req)}`, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
  }
  const { token } = await params;
  const link = await findApprovalLink(token);
  if (!link) return NextResponse.json({ error: "Ce lien n'est plus valide. Demandez-en un nouveau à votre agence." }, { status: 404 });
  const drafts = await prisma.draft.findMany({
    where: { userId: link.userId, status: "à valider" },
    select: { id: true, text: true, imageUrl: true, videoUrl: true, youtubeUrl: true, target: true, scheduledAt: true, clientFeedback: true, clientFeedbackAt: true },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 100,
  });
  return NextResponse.json({
    client: link.user.companyName || link.user.name,
    agency: link.user.agency?.name ?? null,
    posts: drafts.map((d) => ({ ...d, onPage: d.target !== "person" })),
  });
}
