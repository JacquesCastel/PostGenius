import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getLanding, LANDING_DEFAULTS } from "@/lib/landing";

// Contenu éditable de la landing (admin)

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const content = await getLanding();
  return NextResponse.json({ content, defaults: LANDING_DEFAULTS });
}

export async function PUT(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const body = await req.json();
  // On ne garde que les sections connues
  const content = {
    hero: body.hero || LANDING_DEFAULTS.hero,
    plans: Array.isArray(body.plans) ? body.plans : LANDING_DEFAULTS.plans,
    faq: Array.isArray(body.faq) ? body.faq : LANDING_DEFAULTS.faq,
  };

  await prisma.siteContent.upsert({
    where: { key: "landing" },
    update: { value: JSON.stringify(content) },
    create: { key: "landing", value: JSON.stringify(content) },
  });

  return NextResponse.json({ ok: true, content });
}
