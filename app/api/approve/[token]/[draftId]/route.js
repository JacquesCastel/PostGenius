import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { findApprovalLink, notifyAgencyOfDecision } from "@/lib/approval";

// Public : le client valide un post (il partira à la date prévue) ou demande des modifications (l'agence les voit dans « À traiter »)
export async function POST(req, { params }) {
  if (!rateLimit(`approve-act:${clientIp(req)}`, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
  }
  const { token, draftId } = await params;
  const link = await findApprovalLink(token);
  if (!link) return NextResponse.json({ error: "Ce lien n'est plus valide. Demandez-en un nouveau à votre agence." }, { status: 404 });
  const { action, comment } = await req.json().catch(() => ({}));
  if (action !== "approve" && action !== "changes") return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  const note = String(comment ?? "").trim().slice(0, 1000);
  if (action === "changes" && !note) return NextResponse.json({ error: "Précisez ce qu'il faut modifier." }, { status: 400 });

  const draft = await prisma.draft.findFirst({ where: { id: draftId, userId: link.userId }, select: { id: true, status: true } });
  if (!draft) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  if (draft.status !== "à valider") return NextResponse.json({ error: "Ce post a déjà été traité.", code: "done" }, { status: 409 });

  if (action === "approve") {
    await prisma.draft.update({ where: { id: draft.id }, data: { status: "programmé", publishError: null, clientFeedback: null, clientFeedbackAt: null } });
  } else {
    await prisma.draft.update({ where: { id: draft.id }, data: { clientFeedback: note, clientFeedbackAt: new Date() } });
  }
  notifyAgencyOfDecision({ agencyId: link.user.agencyId, clientName: link.user.companyName || link.user.name, approved: action === "approve", comment: note });
  return NextResponse.json({ ok: true });
}
