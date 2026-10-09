import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/agency";
import bcrypt from "bcryptjs";


// GET /api/agency/clients — liste les clients de l'agence
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const clients = await prisma.user.findMany({
      where: { agencyId: auth.agencyId },
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
      guided,
    } = await req.json();
    // Un client est une entreprise : son nom sert aussi de nom du compte, tant qu'aucune personne n'est ajoutée
    const clientName = (companyName?.trim() || name?.trim() || "");
    if (!clientName) return NextResponse.json({ error: "Le nom de l'entreprise est requis." }, { status: 400 });

    // Email : soit fourni, soit généré (le client ne se connecte jamais)
    const clientEmail = email?.trim() ||
      `client-${Date.now()}-${Math.random().toString(36).slice(2)}@managed.postgenius.internal`;

    // Mot de passe aléatoire inutilisable (le client ne se connecte pas)
    const password = await bcrypt.hash(Math.random().toString(36) + Math.random().toString(36), 10);

    const client = await prisma.user.create({
      data: {
        name: clientName,
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
        agencyId: auth.agencyId,
        // Création guidée : le profil est complété ensuite avec le parcours d'onboarding, dans l'espace du client
        // (compagnon, import de posts, premier post). Sans `guided`, le profil est considéré comme rempli.
        onboardedAt: guided === true ? null : new Date(),
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
