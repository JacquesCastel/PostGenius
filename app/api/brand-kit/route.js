import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { getContextFor } from "@/lib/contexts";
import { findKit, saveKit } from "@/lib/brandKitStore";

// GET /api/brand-kit — retourne la charte graphique de l'utilisateur (ou valeurs par défaut)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // Charte de l'entreprise demandée (?contextId=…), sinon de l'entreprise principale
  const contextId = new URL(req.url).searchParams.get("contextId") || null;
  if (contextId && !(await getContextFor(userId, contextId))) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 400 });
  const kit = await findKit(userId, contextId);
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

  const { primaryColor, secondaryColor, accentColor, logoUrl, backgroundUrl, fontFamily, bgStyle, tagline, contextId = null } = await req.json();
  if (contextId && !(await getContextFor(userId, contextId))) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 400 });

  const kit = await saveKit(userId, contextId, {
    ...(primaryColor   !== undefined && { primaryColor }),
    ...(secondaryColor !== undefined && { secondaryColor }),
    ...(accentColor    !== undefined && { accentColor }),
    ...(logoUrl        !== undefined && { logoUrl }),
    ...(backgroundUrl  !== undefined && { backgroundUrl }),
    ...(fontFamily     !== undefined && { fontFamily }),
    ...(bgStyle        !== undefined && { bgStyle }),
    ...(tagline        !== undefined && { tagline }),
  });

  return NextResponse.json({ brandKit: kit });
}
