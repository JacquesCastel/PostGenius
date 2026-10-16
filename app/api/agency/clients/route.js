import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency, clientScope, MAX_AGENCY_CLIENTS } from "@/lib/agency";
import { notifySeatsLimit, CONTACT_EMAIL } from "@/lib/agencyTeam";
import { notifyAgency, clientLabel } from "@/lib/agencyNotify";
import bcrypt from "bcryptjs";


// GET /api/agency/clients — liste les clients de l'agence
export async function GET(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const clients = await prisma.user.findMany({
      where: clientScope(auth),
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
  if (auth.role !== "owner") return NextResponse.json({ error: "Seul le propriétaire de l'agence peut créer un client." }, { status: 403 });
  // Plafond de l'offre : au-delà, sur contact (les clients existants ne sont jamais touchés) ; l'équipe est prévenue une fois
  if ((await prisma.user.count({ where: { agencyId: auth.agencyId } })) >= MAX_AGENCY_CLIENTS) {
    await notifySeatsLimit({ agencyId: auth.agencyId, ownerId: auth.userId, kind: "clients", limit: MAX_AGENCY_CLIENTS });
    return NextResponse.json({ error: `Votre agence gère déjà ${MAX_AGENCY_CLIENTS} clients, le maximum de l'offre. Au-delà, écrivez-nous à ${CONTACT_EMAIL}.`, code: "clients_limit" }, { status: 403 });
  }

  try {
    const {
      name, email, companyName, website,
      headline, businessDescription, targetAudience,
      tone, themes, styleNotes,
      guided, memberIds,
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

    // Le collaborateur qui crée un client y est affecté (utile quand l'agence cloisonne ses clients)
    if (auth.role !== "owner") await prisma.clientAccess.create({ data: { agencyId: auth.agencyId, clientId: client.id, memberId: auth.userId } });

    // Équipiers choisis à la création (propriétaire) : le client leur est affecté et ils en sont prévenus
    if (auth.role === "owner" && Array.isArray(memberIds) && memberIds.length) {
      const valid = await prisma.agencyMember.findMany({ where: { agencyId: auth.agencyId, userId: { in: memberIds.map(String) }, role: { not: "owner" } }, select: { userId: true } });
      if (valid.length) {
        await prisma.clientAccess.createMany({ data: valid.map((m) => ({ agencyId: auth.agencyId, clientId: client.id, memberId: m.userId })), skipDuplicates: true });
        await notifyAgency({ agencyId: auth.agencyId, clientId: client.id, userIds: valid.map((m) => m.userId), kind: "assigned", view: "clients", title: `Le client ${clientLabel(client)} vous est affecté`, body: "Il apparaît maintenant dans « Mes clients »." });
      }
    }

    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    console.error("POST /api/agency/clients:", e.message);
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Un compte avec cet e-mail existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
