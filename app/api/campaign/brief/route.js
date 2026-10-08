import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, limitBody } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { logUsage } from "@/lib/usage";
import { extractDocumentText, DocError, MAX_FILE_BYTES } from "@/lib/docExtract";
import { cleanText } from "@/lib/knowledgeText";
import { BRIEF_SYSTEM, BRIEF_MAX_CHARS, briefPrompt, normalizeBrief } from "@/lib/campaignBrief";

// Importe un brief de campagne (fichier PDF / Word ou texte collé) et le renvoie structuré, à relire par le client.
// Rien n'est enregistré ici : la campagne n'existe qu'à la validation du client. Le fichier n'est pas conservé.

export const maxDuration = 120;

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Analyse indisponible : clé IA manquante sur le serveur." }, { status: 500 });
  const feat = await checkFeature(userId, "campaigns", "L'outil de campagne");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  if (!rateLimit(`campaign-brief:${userId}`, { limit: 10, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop d'imports pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 200_000) return NextResponse.json({ error: "Fichier trop volumineux (8 Mo au maximum)." }, { status: 413 });

  let text = "";
  let origin = "text";
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (8 Mo au maximum)." }, { status: 413 });
      const doc = await extractDocumentText(Buffer.from(await file.arrayBuffer()));
      text = doc.text;
      origin = doc.kind;
    } else {
      const body = await req.json().catch(() => ({}));
      text = cleanText(body.text);
    }
  } catch (e) {
    if (e instanceof DocError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Erreur lecture du brief:", e);
    return NextResponse.json({ error: "Échec de la lecture du document." }, { status: 500 });
  }
  text = String(text ?? "").trim();
  if (text.length < 200) return NextResponse.json({ error: "Ce brief est trop court pour être analysé (au moins 200 caractères)." }, { status: 400 });
  const truncated = text.length > BRIEF_MAX_CHARS;
  text = text.slice(0, BRIEF_MAX_CHARS);

  let raw = null;
  for (let attempt = 1; attempt <= 2 && !raw; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 8000, system: BRIEF_SYSTEM, messages: [{ role: "user", content: briefPrompt(text) }] }),
      });
      if (!res.ok) throw new Error("API Claude indisponible (" + res.status + ")");
      const data = await res.json();
      logUsage(userId, { context: "brief de campagne", inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 });
      raw = JSON.parse((data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "null");
    } catch (e) {
      console.error("Erreur analyse du brief:", e.message);
    }
  }
  if (!raw) return NextResponse.json({ error: "L'analyse du brief a échoué. Réessayez dans un instant." }, { status: 502 });
  const brief = normalizeBrief(raw, text);
  if (truncated) brief.missing = [`Le document est très long : seuls les ${BRIEF_MAX_CHARS.toLocaleString("fr-FR")} premiers caractères ont été lus.`, ...brief.missing].slice(0, 10);
  return NextResponse.json({ brief, chars: text.length, from: origin });
}
