import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
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
      const prompt = `Voici un post LinkedIn :
"""
${text.slice(0, 3000)}
"""

Donne 2 à 3 conseils CONCIS et actionnables (chacun en une phrase courte à l'impératif, en français) pour augmenter son potentiel d'engagement. Concentre-toi sur l'accroche, la lisibilité, l'incitation à commenter. Réponds UNIQUEMENT en JSON : {"tips":["...","..."]}`;
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
