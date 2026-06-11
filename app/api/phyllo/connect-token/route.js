import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { phylloFetch, phylloEnv, isPhylloConfigured, getLinkedInPlatformId } from "@/lib/phyllo";

// Prépare la connexion Phyllo : crée l'utilisateur Phyllo si besoin,
// génère le token du SDK Connect et renvoie les infos d'initialisation.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!isPhylloConfigured()) {
    return NextResponse.json(
      { error: "PHYLLO_CLIENT_ID / PHYLLO_SECRET manquants dans .env" },
      { status: 500 }
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 1. Utilisateur Phyllo (un par compte client) — auto-réparation si
    // l'identifiant stocké n'existe pas/plus dans cet environnement Phyllo
    let phylloUserId = user.phylloUserId;

    if (phylloUserId) {
      try {
        await phylloFetch(`/v1/users/${phylloUserId}`, { silent: true });
      } catch {
        phylloUserId = null; // invalide → on le retrouve ou on le recrée
      }
    }
    if (!phylloUserId) {
      // L'utilisateur existe peut-être déjà chez Phyllo (tentative précédente)
      try {
        const found = await phylloFetch(`/v1/users/external_id/${userId}`, { silent: true });
        phylloUserId = found.id ?? null;
      } catch {}
    }
    if (!phylloUserId) {
      const created = await phylloFetch("/v1/users", {
        method: "POST",
        body: { name: user.name || user.email, external_id: userId },
      });
      phylloUserId = created.id;
    }
    if (phylloUserId !== user.phylloUserId) {
      await prisma.user.update({ where: { id: userId }, data: { phylloUserId } });
    }

    // 2. Token SDK (identité + engagement)
    const tokenRes = await phylloFetch("/v1/sdk-tokens", {
      method: "POST",
      body: { user_id: phylloUserId, products: ["IDENTITY", "ENGAGEMENT"] },
    });

    // 3. Plateforme LinkedIn (pour ouvrir directement le bon connecteur)
    const workPlatformId = await getLinkedInPlatformId();

    return NextResponse.json({
      token: tokenRes.sdk_token,
      phylloUserId,
      workPlatformId,
      environment: phylloEnv(),
    });
  } catch (e) {
    console.error("Erreur connect-token Phyllo:", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
