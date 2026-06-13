import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

// Liste des demandes de contact (admin)
export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  const unhandled = messages.filter((m) => !m.handled).length;
  return NextResponse.json({ messages, unhandled });
}
