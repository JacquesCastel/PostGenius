import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { sendMail } from "@/lib/mailer";
import { CONTACT_EMAIL } from "@/lib/contact";

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

  const data = {
    name: name.trim().slice(0, 120),
    email: email.trim().toLowerCase().slice(0, 200),
    subject: subject?.trim().slice(0, 200) || null,
    message: message.trim(),
  };
  await prisma.contactMessage.create({ data });

  // Le message arrive aussi dans la boîte de contact ; « Répondre » écrit directement au visiteur. Un échec d'envoi ne perd rien : le message est déjà enregistré.
  try {
    const one = (v) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();
    await sendMail({
      kind: "contact",
      to: CONTACT_EMAIL,
      replyTo: data.email,
      subject: `[Contact] ${one(data.subject) || `Message de ${one(data.name)}`}`.slice(0, 200),
      text: `De : ${one(data.name)} <${data.email}>\n${data.subject ? `Objet : ${one(data.subject)}\n` : ""}\n${data.message}\n\n---\nMessage reçu via le formulaire de contact de LinkeePost. Répondez à ce message pour écrire à ${one(data.name)}.`,
    });
  } catch (e) {
    console.error("[contact] envoi à la boîte de contact échoué :", e.message);
  }

  return NextResponse.json({ ok: true });
}
