import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Réception d'une demande via le formulaire de contact public.
export async function POST(req) {
  if (!rateLimit(`contact:${clientIp(req)}`, { limit: 5, windowMs: 600_000 })) {
    return NextResponse.json({ error: "Trop d'envois. Réessayez plus tard." }, { status: 429 });
  }

  const { name, email, subject, message } = await req.json();
  if (!name?.trim() || !email?.includes("@") || !message?.trim()) {
    return NextResponse.json({ error: "Nom, email valide et message sont requis." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message trop long (5000 caractères max)." }, { status: 400 });
  }

  await prisma.contactMessage.create({
    data: {
      name: name.trim().slice(0, 120),
      email: email.trim().toLowerCase().slice(0, 200),
      subject: subject?.trim().slice(0, 200) || null,
      message: message.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}
