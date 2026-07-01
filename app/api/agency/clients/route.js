import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import bcrypt from "bcryptjs";

// Vérifie que l'utilisateur est bien sur le plan Agence
async function requireAgency(req) {
  const userId = await getUserId(req);
  if (!userId) return { error: "Non connecté", status: 401 };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!user) return { error: "Utilisateur introuvable", status: 404 };
  if (user.plan !== "agence") return { error: "Réservé au plan Agence", status: 403 };
  return { userId };
}

// GET /api/agency/clients — liste les clients de l'agence
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const clients = await prisma.user.findMany({
      where: { managedByUserId: auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        headline: true,
        createdAt: true,
        linkedin: { select: { personName: true, orgName: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ clients });
  } catch (e) {
    console.error("GET /api/agency/clients:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/agency/clients — crée un compte client
export async function POST(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const {
      name, email, companyName, website,
      headline, businessDescription, targetAudience,
      tone, themes, styleNotes,
    } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

    // Email : soit fourni, soit généré (le client ne se connecte jamais)
    const clientEmail = email?.trim() ||
      `client-${Date.now()}-${Math.random().toString(36).slice(2)}@managed.postgenius.internal`;

    // Mot de passe aléatoire inutilisable (le client ne se connecte pas)
    const password = await bcrypt.hash(Math.random().toString(36) + Math.random().toString(36), 10);

    const client = await prisma.user.create({
      data: {
        name: name.trim(),
        email: clientEmail,
        password,
        companyName:         companyName?.trim()         || null,
        website:             website?.trim()              || null,
        headline:            headline?.trim()             || null,
        businessDescription: businessDescription?.trim()  || null,
        targetAudience:      targetAudience?.trim()       || null,
        tone:                tone?.trim()                 || "Professionnel",
        themes:              themes?.trim()               || null,
        styleNotes:          styleNotes?.trim()           || null,
        plan: "agence",
        managedByUserId: auth.userId,
        onboardedAt: new Date(), // profil déjà rempli par l'agence — pas besoin d'onboarding
      },
      select: { id: true, name: true, email: true, companyName: true, headline: true, createdAt: true },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    console.error("POST /api/agency/clients:", e.message);
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Un compte avec cet e-mail existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
