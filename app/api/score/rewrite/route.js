import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { logUsage } from "@/lib/usage";
import { scorePost } from "@/lib/score";

// Réécrit un post en appliquant les améliorations d'engagement détectées.
export const maxDuration = 60;

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Clé IA manquante." }, { status: 500 });

  const { text, type, scope = "all" } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Texte requis." }, { status: 400 });

  // Liste des améliorations à appliquer (critères non réussis)
  const heur = scorePost({ text, type });
  const improvements = heur.factors.filter((f) => !f.ok).map((f) => `- ${f.label} : ${f.advice}`);

  // Périmètre de la réécriture
  const SCOPE = {
    all: "Réécris l'INTÉGRALITÉ du post.",
    hook: "Réécris UNIQUEMENT l'accroche (la toute première ligne). Conserve EXACTEMENT le reste du post tel quel. Renvoie le post complet.",
    body: "Réécris UNIQUEMENT le corps du post (tout sauf la première ligne d'accroche et la conclusion / appel à l'action final). Conserve l'accroche et la conclusion à l'identique. Renvoie le post complet.",
    signature: "Réécris ou ajoute UNIQUEMENT la conclusion : l'appel à l'action final et la signature. Conserve l'accroche et le corps à l'identique. Renvoie le post complet.",
  };
  const scopeInstruction = SCOPE[scope] || SCOPE.all;

  // Style de l'auteur pour rester fidèle
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tone: true, styleNotes: true },
  });

  const prompt = `Voici un post LinkedIn :
"""
${text}
"""

PÉRIMÈTRE : ${scopeInstruction}

Améliore le post pour MAXIMISER son potentiel d'engagement, en appliquant ces pistes (uniquement sur la partie concernée par le périmètre ci-dessus) :
${improvements.length ? improvements.join("\n") : "- Renforce l'accroche, l'aération et l'incitation à commenter."}

Règles :
- Garde le même sujet, la même langue (français) et le même message.
- Respecte le ton ${user?.tone ? `"${user.tone}"` : "de l'auteur"}.${user?.styleNotes ? `\n- Consignes de style à respecter : ${user.styleNotes}.` : ""}
- Réponds UNIQUEMENT avec le texte du post complet réécrit (aucun commentaire autour).`;

  let data;
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    data = await aiRes.json();
    if (!aiRes.ok) throw new Error("api");
  } catch {
    return NextResponse.json({ error: "La réécriture a échoué. Réessayez." }, { status: 502 });
  }

  const out = (data?.content?.[0]?.text || "").trim();
  if (!out) return NextResponse.json({ error: "Réécriture vide." }, { status: 502 });

  logUsage(userId, {
    kind: "claude",
    context: "score-rewrite",
    inputTokens: data?.usage?.input_tokens ?? 0,
    outputTokens: data?.usage?.output_tokens ?? 0,
  });

  return NextResponse.json({ text: out });
}
