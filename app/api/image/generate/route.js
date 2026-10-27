import { userWithContext } from "@/lib/contexts";
import { findKit } from "@/lib/brandKitStore";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveImage } from "@/lib/image";
import { generateImageB64 } from "@/lib/openaiImage";
import { logUsage } from "@/lib/usage";
import { checkImageQuota, checkAccess, limitBody } from "@/lib/gating";

// Génère une image pour un post : prompt fourni par le client,
// ou rédigé par Claude à partir du contenu du post + contexte de marque.
// Génération via les modèles « gpt-image » d'OpenAI (OPENAI_API_KEY) : voir lib/openaiImage.js.

export const maxDuration = 120;

function brandKitBlock(brandKit) {
  if (!brandKit) return "";
  const colors = [
    brandKit.primaryColor && `principale ${brandKit.primaryColor}`,
    brandKit.accentColor && `d'accent ${brandKit.accentColor}`,
  ]
    .filter(Boolean)
    .join(", ");
  if (!colors) return "";
  return `\n\nCharte graphique de la marque (à respecter dans l'ambiance chromatique de l'image — traduis
ces couleurs en description visuelle naturelle dans le prompt final, ne mentionne jamais de code hex) :
- Couleur ${colors}.`;
}

async function writeImagePrompt(user, postText, brandKit) {
  const prompt = `Voici un post LinkedIn :
"""
${postText.slice(0, 1500)}
"""
Contexte de l'auteur : ${user.businessDescription ?? user.expertise ?? "professionnel"}${
    user.targetAudience ? ` — cible : ${user.targetAudience}` : ""
  }${brandKitBlock(brandKit)}

Écris un prompt EN ANGLAIS pour générer l'illustration de ce post.
Contraintes impératives :
- AUCUN texte, lettre ou chiffre dans l'image
- Style professionnel, moderne et épuré, adapté à un feed LinkedIn
- Une métaphore visuelle du message principal du post, pas une scène littérale
- Composition simple, lisible en petit format
- Si une charte graphique est indiquée ci-dessus, la palette de l'image doit s'en rapprocher

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
  if (!res.ok) {
    console.warn("Prompt image (Anthropic):", res.status, (await res.text()).slice(0, 200));
    throw new Error(`Échec de la rédaction du prompt d'image (Anthropic ${res.status}). Réessayez, ou écrivez vous-même la description de l'image.`);
  }
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
  if (!imgQuota.ok) return NextResponse.json(limitBody(imgQuota), { status: 403 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY manquante dans .env (requise pour la génération d'images)." },
      { status: 500 }
    );
  }

  const { text, prompt: customPrompt, useBrandKit = true, contextId = null } = await req.json();
  if (!text?.trim() && !customPrompt?.trim()) {
    return NextResponse.json({ error: "Texte du post ou prompt requis." }, { status: 400 });
  }

  try {
    const { user } = await userWithContext(userId, contextId);
    const finalPrompt = customPrompt?.trim() || (await writeImagePrompt(user, text, useBrandKit ? await findKit(userId, contextId || null) : null));

    const gen = await generateImageB64(finalPrompt);
    if (gen.error) return NextResponse.json({ error: gen.error }, { status: gen.status });
    const b64 = gen.b64;

    const { url } = await saveImage(b64);
    logUsage(userId, { kind: "image", context: "image", images: 1 });
    return NextResponse.json({ url, prompt: finalPrompt });
  } catch (e) {
    console.error("Erreur génération image:", e);
    return NextResponse.json({ error: e.message || "Échec de la génération d'image." }, { status: 500 });
  }
}
