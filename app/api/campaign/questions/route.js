import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { userContextBlock } from "@/lib/campaign";
import { logUsage } from "@/lib/usage";

// L'IA pose 3 questions de cadrage sur le thème de campagne,
// en s'appuyant sur le contexte métier déjà connu du client.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { theme, objective } = await req.json();
  if (!theme?.trim()) return NextResponse.json({ error: "Thème requis." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const prompt = `Un client prépare une campagne de posts LinkedIn sur le thème : "${theme}"${
    objective ? ` (objectif : ${objective})` : ""
  }.

Ce que l'on sait déjà du client :${userContextBlock(user) || "\n- (rien)"}

Pose exactement 3 questions COURTES et CONCRÈTES pour cadrer la campagne.
Règles :
- Ne demande JAMAIS une information déjà connue ci-dessus
- Les questions doivent aider à produire des posts précis : angles, exemples clients,
  chiffres, anecdotes, positions à défendre, messages clés
- Adapte les questions au métier et au marché du client

Réponds UNIQUEMENT en JSON : {"questions": ["...", "...", "..."]}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error("API Claude (" + res.status + ")");
    const data = await res.json();
    logUsage(userId, {
      context: "cadrage",
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    });
    const match = (data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match[0]);
    return NextResponse.json({ questions: (parsed.questions ?? []).slice(0, 4) });
  } catch (e) {
    console.error("Erreur questions campagne:", e);
    return NextResponse.json({ error: "Impossible de générer les questions." }, { status: 502 });
  }
}
