import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { slugify } from "@/lib/markdown";

// Liste / création d'articles de blog (admin)

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const articles = await prisma.article.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ articles });
}

export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { title, excerpt, content, coverImage, published } = await req.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Titre et contenu requis." }, { status: 400 });
  }

  // Slug unique (suffixe -2, -3… si déjà pris)
  let base = slugify(title) || "article";
  let slug = base;
  let i = 2;
  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }

  const article = await prisma.article.create({
    data: {
      slug,
      title: title.trim(),
      excerpt: excerpt?.trim() || null,
      content,
      coverImage: coverImage?.trim() || null,
      published: Boolean(published),
      publishedAt: published ? new Date() : null,
    },
  });
  return NextResponse.json({ article });
}
