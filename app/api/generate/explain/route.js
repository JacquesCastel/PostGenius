import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { logUsage } from "@/lib/usage";
import { checkAccess } from "@/lib/gating";
import { WHY_INSTRUCTION, WHY_JSON_FORMAT, cleanWhy } from "@/lib/linkedinRules";

// "Réanalyser" : explique la forme d'un post dont le texte a été modifié à la main
// (les explications renvoyées à la génération ne décrivent plus la version affichée).

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Clé IA manquante." }, { status: 500 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Texte requis." }, { status: 400 });

  const prompt = `Voici un post LinkedIn :
"""
${text.slice(0, 3000)}
"""

Explique la forme de CE post, tel qu'il est écrit. Décris factuellement chaque choix et son effet sur le lecteur ; si un élément est absent ou faible, dis-le simplement (ex : « Pas de hashtags. »).

${WHY_INSTRUCTION}

Réponds UNIQUEMENT en JSON : {${WHY_JSON_FORMAT}}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_CHAT_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error("api " + res.status);
    const data = await res.json();
    logUsage(userId, {
      kind: "claude",
      context: "explication",
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    });
    const match = (data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
    const why = match ? cleanWhy(JSON.parse(match[0]).why, text) : null;
    if (!why) throw new Error("réponse vide");
    return NextResponse.json({ why });
  } catch (e) {
    console.error("Erreur explication du post:", e.message);
    return NextResponse.json({ error: "L'analyse a échoué. Réessayez." }, { status: 502 });
  }
}
