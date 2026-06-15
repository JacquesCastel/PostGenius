import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { saveImage } from "@/lib/image";
import { logUsage } from "@/lib/usage";
import { checkImageQuota, checkAccess } from "@/lib/gating";

// Génère une image pour un post : prompt fourni par le client,
// ou rédigé par Claude à partir du contenu du post + contexte de marque.
// Génération via OpenAI gpt-image-1 (OPENAI_API_KEY).

export const maxDuration = 120;

async function writeImagePrompt(user, postText) {
  const prompt = `Voici un post LinkedIn :
"""
${postText.slice(0, 1500)}
"""
Contexte de l'auteur : ${user.businessDescription ?? user.expertise ?? "professionnel"}${
    user.targetAudience ? ` — cible : ${user.targetAudience}` : ""
  }

Écris un prompt EN ANGLAIS pour générer l'illustration de ce post.
Contraintes impératives :
- AUCUN texte, lettre ou chiffre dans l'image
- Style professionnel, moderne et épuré, adapté à un feed LinkedIn
- Une métaphore visuelle du message principal du post, pas une scène littérale
- Composition simple, lisible en petit format

Réponds UNIQUEMENT en JSON : {"prompt": "..."}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("Échec de la rédaction du prompt d'image.");
  const data = await res.json();
  logUsage(user.id, {
    context: "prompt-image",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  });
  const match = (data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
  return JSON.parse(match[0]).prompt;
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  const imgQuota = await checkImageQuota(userId);
  if (!imgQuota.ok) return NextResponse.json({ error: imgQuota.error }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY manquante dans .env (requise pour la génération d'images)." },
      { status: 500 }
    );
  }

  const { text, prompt: customPrompt } = await req.json();
  if (!text?.trim() && !customPrompt?.trim()) {
    return NextResponse.json({ error: "Texte du post ou prompt requis." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const finalPrompt = customPrompt?.trim() || (await writeImagePrompt(user, text));

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: finalPrompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI images:", res.status, err.slice(0, 300));
      let detail = "";
      try {
        detail = JSON.parse(err).error?.message ?? "";
      } catch {}
      return NextResponse.json(
        { error: `Génération d'image refusée (${res.status})${detail ? " : " + detail : ""}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error("Réponse OpenAI sans image.");

    const { url } = await saveImage(b64);
    logUsage(userId, { kind: "image", context: "image", images: 1 });
    return NextResponse.json({ url, prompt: finalPrompt });
  } catch (e) {
    console.error("Erreur génération image:", e);
    return NextResponse.json({ error: e.message || "Échec de la génération d'image." }, { status: 500 });
  }
}
