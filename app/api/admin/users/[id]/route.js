import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { isPlanId } from "@/lib/plans";

// Gestion d'un compte client : suspendre/réactiver, changer le plan/rôle, prolonger l'accès, supprimer

export async function PATCH(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data = {};

  // Suspension / réactivation (pas sur son propre compte)
  if (typeof body.disabled === "boolean") {
    if (id === admin.id) {
      return NextResponse.json({ error: "Impossible de suspendre votre propre compte." }, { status: 400 });
    }
    data.disabled = body.disabled;
  }

  // Changement de rôle (pas sur son propre compte)
  if (typeof body.role === "string") {
    if (!["user", "admin"].includes(body.role)) {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    }
    if (id === admin.id) {
      return NextResponse.json({ error: "Impossible de changer votre propre rôle." }, { status: 400 });
    }
    data.role = body.role;
  }

  // Changement de plan (autorisé sur tout compte, y compris le sien)
  if (typeof body.plan === "string") {
    if (!isPlanId(body.plan)) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }
    data.plan = body.plan;
    data.planUpdatedAt = new Date();
  }

  // Prolongation de l'accès offert ou de l'essai : N jours de plus, à partir de la fin actuelle (ou d'aujourd'hui si elle est passée)
  if (body.extendDays != null) {
    const days = Number(body.extendDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: "Durée invalide (1 à 365 jours)." }, { status: 400 });
    }
    const u = await prisma.user.findUnique({ where: { id }, select: { trialEndsAt: true } });
    if (!u) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    const from = u.trialEndsAt && u.trialEndsAt.getTime() > Date.now() ? u.trialEndsAt.getTime() : Date.now();
    data.trialEndsAt = new Date(from + days * 86400000);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte." }, { status: 400 });
  }
  // Cascade Prisma : drafts, campagnes, sources, usage, tokens LinkedIn
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
