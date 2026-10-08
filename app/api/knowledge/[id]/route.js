import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { MAX_PINNED } from "@/lib/knowledgeText";
import { resolveSourceScope } from "@/lib/contexts";

// Renommer, épingler (« toujours utiliser ») ou supprimer une source de la base de connaissances.

export async function PATCH(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data = {};
  if (typeof body.title === "string") {
    const t = body.title.trim().slice(0, 120);
    if (!t) return NextResponse.json({ error: "Le titre ne peut pas être vide." }, { status: 400 });
    data.title = t;
  }
  if (typeof body.pinned === "boolean") {
    if (body.pinned) {
      const n = await prisma.knowledgeSource.count({ where: { userId, pinned: true, NOT: { id } } });
      if (n >= MAX_PINNED) return NextResponse.json({ error: `Vous pouvez épingler ${MAX_PINNED} sources au plus.` }, { status: 400 });
    }
    data.pinned = body.pinned;
  }
  if (body.contextId !== undefined || body.shared !== undefined) {
    try {
      const scope = await resolveSourceScope(userId, body);
      data.contextId = scope.shared ? null : scope.contextId;
      data.shared = scope.shared;
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
  const { count } = await prisma.knowledgeSource.updateMany({ where: { id, userId }, data });
  if (count === 0) return NextResponse.json({ error: "Source introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const { id } = await params;
  const { count } = await prisma.knowledgeSource.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Source introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
