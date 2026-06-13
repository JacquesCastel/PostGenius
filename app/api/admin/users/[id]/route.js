import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { isPlanId } from "@/lib/plans";

// Gestion d'un compte client : suspendre/réactiver, changer le plan/rôle, supprimer

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
