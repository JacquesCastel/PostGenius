import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, isAdminUser } from "@/lib/admin";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

// POST /api/admin/users/:id/view-as — support : voir l'outil comme ce client.
// Session LECTURE SEULE de 2 h (verrouillée par middleware.js). Pour en sortir,
// DELETE /api/agency/impersonate rend la session normale de l'admin.
export async function POST(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "C'est déjà votre compte." }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (isAdminUser(target)) {
    return NextResponse.json({ error: "Impossible de voir un compte administrateur." }, { status: 400 });
  }

  // Trace d'audit (logs du conteneur) : qui a consulté quel compte
  console.log(`[support] ${admin.email} consulte le compte ${target.email} (lecture seule)`);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(admin.id, target.id, { support: true }),
    sessionCookieOptions({ support: true })
  );
  return res;
}
