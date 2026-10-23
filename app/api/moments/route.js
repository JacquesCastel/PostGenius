import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getContextFor } from "@/lib/contexts";
import { cleanMomentInput, momentState, MAX_MOMENTS } from "@/lib/moments";

// Temps forts de l'utilisateur : liste (GET) et création (POST), rattachés à une thématique.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const rows = await prisma.moment.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }], include: { _count: { select: { sources: true, drafts: true } } } });
  const moments = rows.map(({ _count, ...m }) => ({ ...m, state: momentState(m), sources: _count.sources, posts: _count.drafts }));
  return NextResponse.json({ moments, max: MAX_MOMENTS });
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { data, bad } = cleanMomentInput(body);
  if (!data.name) return NextResponse.json({ error: "Le nom du temps fort est requis." }, { status: 400 });
  if (bad.length) return NextResponse.json({ error: bad.includes("endsAt") && data.startsAt && data.endsAt ? "La fin doit être après le début." : "Dates invalides." }, { status: 400 });
  let contextId = null;
  if (body.contextId && body.contextId !== "main") {
    const ctx = await getContextFor(userId, String(body.contextId));
    if (!ctx) return NextResponse.json({ error: "Thématique introuvable." }, { status: 404 });
    contextId = ctx.id;
  }
  if ((await prisma.moment.count({ where: { userId, archivedAt: null } })) >= MAX_MOMENTS) {
    return NextResponse.json({ error: `Vous pouvez avoir ${MAX_MOMENTS} temps forts en cours au plus : archivez-en un.` }, { status: 400 });
  }
  delete data.archivedAt;
  const moment = await prisma.moment.create({ data: { userId, contextId, ...data } });
  return NextResponse.json({ moment: { ...moment, state: momentState(moment), sources: 0, posts: 0 } }, { status: 201 });
}
