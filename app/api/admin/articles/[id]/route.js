import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { slugify } from "@/lib/markdown";

// Édition / suppression d'un article (admin)

export async function PATCH(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });

  const body = await req.json();
  const data = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.excerpt === "string") data.excerpt = body.excerpt.trim() || null;
  if (typeof body.content === "string") data.content = body.content;
  if (typeof body.coverImage === "string") data.coverImage = body.coverImage.trim() || null;
  if (typeof body.slug === "string" && body.slug.trim()) {
    const s = slugify(body.slug);
    const clash = await prisma.article.findUnique({ where: { slug: s } });
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
    }
    data.slug = s;
  }
  if (typeof body.published === "boolean") {
    data.published = body.published;
    // Fixer publishedAt la première fois qu'on publie
    if (body.published && !existing.publishedAt) data.publishedAt = new Date();
  }

  const article = await prisma.article.update({ where: { id }, data });
  return NextResponse.json({ article });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  await prisma.article.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
