import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { logUsage } from "@/lib/usage";
import { scorePost } from "@/lib/score";
import { checkFeature } from "@/lib/gating";

// Score de potentiel d'engagement (heuristique) + conseils IA courts.
export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const gate = await checkFeature(userId, "scoring", "Le score d'engagement");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { text, type } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Texte requis." }, { status: 400 });

  const heur = scorePost({ text, type });

  let tips = [];
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // Le texte a déjà été rédigé (par une IA ou retouché) en suivant des consignes de
      // bonnes pratiques, et un contrôle automatique (heuristique) vient de vérifier les
      // critères de base ci-dessous. On les transmet explicitement pour éviter que ce
      // second appel ne redécouvre les mêmes points de zéro et ne les répète (ou pire,
      // ne suggère d'ajouter ce qui est déjà présent).
      const alreadyChecked = heur.factors
        .map((f) => `- ${f.label} : ${f.ok ? "déjà bon, ne pas y revenir" : `déjà signalé (« ${f.advice} »)`}`)
        .join("\n");

      const prompt = `Voici un post LinkedIn, déjà rédigé en suivant des consignes de bonnes pratiques (accroche, aération, question finale, hashtags, émojis avec parcimonie) :
"""
${text.slice(0, 3000)}
"""

Un contrôle automatique a déjà évalué ces critères de forme :
${alreadyChecked}

Donne 2 à 3 conseils COMPLÉMENTAIRES, qui n'ont rien à voir avec la liste ci-dessus (ne répète jamais un point déjà couvert, même reformulé). Concentre-toi sur le FOND : clarté du message, crédibilité, storytelling, spécificité des exemples, adéquation avec la cible. Si tu n'as vraiment rien de nouveau à ajouter, réponds avec un tableau tips vide.
Chaque conseil : une phrase courte à l'impératif, en français. Réponds UNIQUEMENT en JSON : {"tips":["...","..."]}`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_CHAT_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const parsed = JSON.parse((data?.content?.[0]?.text || "").replace(/```json|```/g, "").trim());
        if (Array.isArray(parsed.tips)) tips = parsed.tips.slice(0, 3);
        logUsage(userId, {
          kind: "claude",
          context: "score",
          inputTokens: data?.usage?.input_tokens ?? 0,
          outputTokens: data?.usage?.output_tokens ?? 0,
        });
      }
    } catch {
      /* on garde au moins le score heuristique */
    }
  }

  return NextResponse.json({ score: heur.score, level: heur.level, factors: heur.factors, tips });
}
