import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { generateText } from "@/lib/campaign";
import { cleanHistory } from "@/lib/refineChat";

// Post d'exemple pour valider la direction d'une campagne avant
// la génération en masse. Peut être ajusté avec un retour du client.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { theme, objective, context, feedback, previous, mood, history } = await req.json();
  if (!theme?.trim()) return NextResponse.json({ error: "Thème requis." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.expertise) {
    return NextResponse.json({ error: "Complétez votre profil (expertise) avant de créer une campagne." }, { status: 400 });
  }

  let campaignContext = context || "";
  if (objective) campaignContext = `Objectif de la campagne : ${objective}\n${campaignContext}`;
  if (feedback && previous) {
    campaignContext += `\n\nUn post d'exemple a déjà été proposé :\n"""${previous}"""\nLe client demande cet ajustement (PRIORITAIRE) : ${feedback}`;
  }

  try {
    // Ajustement : l'IA répond en une phrase et peut proposer des « À retenir » (préférences durables, jamais appliquées seules)
    const chat = feedback && previous ? { history: cleanHistory(history) } : null;
    const { text, reply, remember } = await generateText(user, theme, campaignContext, null, mood, chat);
    return NextResponse.json({ text, ...(chat ? { reply, remember } : {}) });
  } catch (e) {
    console.error("Erreur sample campagne:", e);
    return NextResponse.json({ error: e.message || "Échec de la génération." }, { status: 502 });
  }
}
