import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

// POST /api/agency/impersonate — démarre l'impersonation d'un client
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { clientId } = await req.json();
  if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

  // Vérifie que ce client appartient à l'agence
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { managedByUserId: true, name: true, companyName: true },
  });
  if (!client || client.managedByUserId !== userId) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  // JWT avec uid=agence + cid=client
  const token = await createSessionToken(userId, clientId);
  const res = NextResponse.json({
    ok: true,
    client: { id: clientId, name: client.name, companyName: client.companyName },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

// DELETE /api/agency/impersonate — arrête l'impersonation, retour sur le compte agence
export async function DELETE(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // JWT sans cid
  const token = await createSessionToken(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
