import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { FOOTER_PAGE_KEYS, FOOTER_PAGE_DEFAULTS } from "@/lib/footer-pages";

// Contenu éditable des pages de pied de page (admin uniquement).
// GET  /api/admin/footer-pages/[key]  → { page }
// PUT  /api/admin/footer-pages/[key]  → { ok, page }

export async function GET(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { key } = await params;
  if (!FOOTER_PAGE_KEYS.includes(key))
    return NextResponse.json({ error: "Page inconnue." }, { status: 404 });

  const row = await prisma.siteContent.findUnique({ where: { key: `page-${key}` } });
  const page = row?.value ? JSON.parse(row.value) : FOOTER_PAGE_DEFAULTS[key];

  return NextResponse.json({ page, defaults: FOOTER_PAGE_DEFAULTS[key] });
}

export async function PUT(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { key } = await params;
  if (!FOOTER_PAGE_KEYS.includes(key))
    return NextResponse.json({ error: "Page inconnue." }, { status: 404 });

  const body = await req.json();
  const page = {
    title: body.title || FOOTER_PAGE_DEFAULTS[key].title,
    sections: Array.isArray(body.sections) ? body.sections : FOOTER_PAGE_DEFAULTS[key].sections,
  };

  await prisma.siteContent.upsert({
    where: { key: `page-${key}` },
    update: { value: JSON.stringify(page) },
    create: { key: `page-${key}`, value: JSON.stringify(page) },
  });

  return NextResponse.json({ ok: true, page });
}
