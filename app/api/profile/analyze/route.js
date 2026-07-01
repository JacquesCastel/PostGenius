import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { logUsage } from "@/lib/usage";

// Analyse le site internet du client et en déduit les champs du profil
// (activité, cible, marché, expertise, thématiques…) via Claude.

export const maxDuration = 60;

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Clé IA manquante (ANTHROPIC_API_KEY)." }, { status: 500 });
  }

  let { url } = await req.json();
  url = (url || "").trim();
  if (!url) return NextResponse.json({ error: "Indiquez l'adresse de votre site." }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Adresse de site invalide." }, { status: 400 });
  }

  // 1) Récupérer le contenu du site
  let text = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LinkeePost/1.0 (analyse profil)" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`code ${res.status}`);
    const html = await res.text();
    text = htmlToText(html).slice(0, 8000);
  } catch (e) {
    return NextResponse.json(
      { error: `Impossible de lire le site (${e.message}). Vérifiez l'adresse.` },
      { status: 502 }
    );
  }
  if (text.length < 60) {
    return NextResponse.json({ error: "Pas assez de contenu lisible sur cette page." }, { status: 422 });
  }

  // 2) Extraction structurée via Claude
  const prompt = `Voici le contenu texte du site web d'un professionnel ou d'une marque :
"""
${text}
"""

À partir de ce contenu, déduis les informations ci-dessous pour alimenter un profil de création de contenu LinkedIn. Sois concret, synthétique et en français. Si une information est absente, mets une chaîne vide "".

Réponds UNIQUEMENT avec un objet JSON valide, sans texte ni backticks autour :
{
  "companyName": "nom de l'entreprise ou de la marque",
  "businessDescription": "activité, produits/services et proposition de valeur (2 à 4 phrases)",
  "targetAudience": "clients / audience cibles",
  "market": "marché, secteur et positionnement",
  "expertise": "domaine d'expertise principal, formulé à la 1re personne (ex : 'Je suis consultant SEO pour les PME')",
  "themes": "3 à 6 thématiques de contenu pertinentes, séparées par des virgules",
  "commGoals": "objectifs de communication probables, séparés par des virgules"
}`;

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
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    data = await aiRes.json();
    if (!aiRes.ok) throw new Error("api");
  } catch {
    return NextResponse.json({ error: "L'analyse IA a échoué. Réessayez." }, { status: 502 });
  }

  const raw = data?.content?.[0]?.text || "";
  let fields;
  try {
    fields = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return NextResponse.json({ error: "L'IA n'a pas renvoyé un format exploitable." }, { status: 502 });
  }

  logUsage(userId, {
    kind: "claude",
    context: "profil-site",
    inputTokens: data?.usage?.input_tokens ?? 0,
    outputTokens: data?.usage?.output_tokens ?? 0,
  });

  return NextResponse.json({ fields });
}
