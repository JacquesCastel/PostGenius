import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { userContextBlock } from "@/lib/campaign";
import { resolveSource } from "@/lib/veille";
import { logUsage } from "@/lib/usage";

// L'IA propose des sources en affinité avec le profil du client ;
// chaque suggestion est validée techniquement (flux RSS joignable)
// avant d'être ajoutée.

export const maxDuration = 120;

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const prompt = `Profil d'un professionnel qui publie sur LinkedIn :${userContextBlock(user) || "\n- (inconnu)"}
- Thématiques favorites : ${user.themes ?? "non renseignées"}

Propose 8 sources de veille (médias, blogs de référence, sites spécialisés) en AFFINITÉ
avec ce profil, pour nourrir ses posts LinkedIn. Privilégie les sources francophones
actives, avec un flux RSS connu. Donne l'URL du flux RSS si tu la connais, sinon
l'URL de la page d'accueil.

Réponds UNIQUEMENT en JSON : {"sources": [{"title": "...", "url": "https://..."}]}`;

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
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error("API Claude (" + res.status + ")");
    const data = await res.json();
    logUsage(userId, {
      context: "sources",
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    });
    const match = (data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
    const candidates = (JSON.parse(match[0]).sources ?? []).slice(0, 8);

    // Validation technique en parallèle : on ne garde que les flux qui répondent
    const validated = await Promise.allSettled(
      candidates.map(async (c) => {
        const { feedUrl } = await resolveSource(c.url);
        return { title: c.title, url: feedUrl };
      })
    );
    const valid = validated
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .slice(0, 5);

    if (!valid.length) {
      return NextResponse.json(
        { error: "Aucune source suggérée n'a pu être validée — ajoutez une source manuellement." },
        { status: 502 }
      );
    }

    // Ajout des sources validées
    const added = [];
    for (const v of valid) {
      const source = await prisma.contentSource.upsert({
        where: { userId_url: { userId, url: v.url } },
        update: {},
        create: { userId, url: v.url, title: v.title },
      });
      added.push(source);
    }
    return NextResponse.json({ added });
  } catch (e) {
    console.error("Erreur suggestion sources:", e);
    return NextResponse.json({ error: e.message || "Échec des suggestions." }, { status: 502 });
  }
}
