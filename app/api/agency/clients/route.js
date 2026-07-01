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
}

// POST /api/agency/clients — crée un compte client
export async function POST(req) {
  const auth = await requireAgency(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, companyName, email } = await req.json();
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
      companyName: companyName?.trim() || null,
      plan: "agence", // hérite des capacités de l'agence
      managedByUserId: auth.userId,
    },
    select: { id: true, name: true, email: true, companyName: true, createdAt: true },
  });

  return NextResponse.json({ client }, { status: 201 });
}
