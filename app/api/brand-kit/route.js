import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// GET /api/brand-kit — retourne la charte graphique de l'utilisateur (ou valeurs par défaut)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  // Retourne le kit existant ou les valeurs par défaut si pas encore créé
  return NextResponse.json({
    brandKit: kit ?? {
      primaryColor:   "#0a66c2",
      secondaryColor: "#ffffff",
      accentColor:    "#ff5a5f",
      logoUrl:        null,
      fontFamily:     "Inter",
      bgStyle:        "solid",
      tagline:        null,
    },
  });
}

// POST /api/brand-kit — crée ou met à jour la charte graphique
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { primaryColor, secondaryColor, accentColor, logoUrl, backgroundUrl, fontFamily, bgStyle, tagline } = await req.json();

  const kit = await prisma.brandKit.upsert({
    where: { userId },
    update: {
      ...(primaryColor   !== undefined && { primaryColor }),
      ...(secondaryColor !== undefined && { secondaryColor }),
      ...(accentColor    !== undefined && { accentColor }),
      ...(logoUrl        !== undefined && { logoUrl }),
      ...(backgroundUrl  !== undefined && { backgroundUrl }),
      ...(fontFamily     !== undefined && { fontFamily }),
      ...(bgStyle        !== undefined && { bgStyle }),
      ...(tagline        !== undefined && { tagline }),
    },
    create: {
      userId,
      primaryColor:   primaryColor   ?? "#0a66c2",
      secondaryColor: secondaryColor ?? "#ffffff",
      accentColor:    accentColor    ?? "#ff5a5f",
      logoUrl:        logoUrl        ?? null,
      backgroundUrl:  backgroundUrl  ?? null,
      fontFamily:     fontFamily     ?? "Inter",
      bgStyle:        bgStyle        ?? "solid",
      tagline:        tagline        ?? null,
    },
  });

  return NextResponse.json({ brandKit: kit });
}
