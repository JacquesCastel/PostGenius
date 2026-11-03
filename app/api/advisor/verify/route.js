import { NextResponse } from "next/server";
import { logUsage } from "@/lib/usage";
import { advisorPreflight, readBody, authorContext } from "@/lib/advisorRoute";
import { buildVerifyPrompt, mapVerifierToAlerts, MAX_TEXT_CHARS, DISCLAIMER } from "@/lib/advisorVerify";
import { parseVerifierOutput } from "@/lib/verifierPrompt.mjs";
import { callClaude, MODELS, errorBody, AdvisorError } from "@/lib/advisorLlm";

// « Vérifier mon post » : relecture factuelle indépendante, à la demande. Avis, jamais une preuve ; ne bloque aucune publication.
export const maxDuration = 60;

export async function POST(req) {
  const pre = await advisorPreflight(req, { bucket: "verify", limit: 30 });
  if (pre.response) return pre.response;
  const body = await readBody(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 2500) : "";
  if (!text) return NextResponse.json({ error: "Aucun texte à vérifier." }, { status: 400 });
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: `Le texte est trop long pour être vérifié (${MAX_TEXT_CHARS} caractères au maximum).` }, { status: 413 });
  if (!brief) return NextResponse.json({ error: "Le brief d'origine est nécessaire à la vérification." }, { status: 400 });
  const ctx = await authorContext(pre.userId, { contextId: body.contextId, sourceIds: body.sourceIds, source: body.source, topic: brief });
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: 400 });
  try {
    const { system, user } = buildVerifyPrompt({ brief, profile: ctx.profile, sourcesBlock: ctx.sourcesBlock, text });
    const model = MODELS.verify();
    let r = await callClaude({ model, system, user, maxTokens: 1500, timeoutMs: 50_000 });
    let parsed = parseVerifierOutput(r.text);
    let inTok = r.inputTokens, outTok = r.outputTokens, ms = r.ms;
    if (!parsed) { // une relance en cas de JSON invalide
      r = await callClaude({ model, system, user, maxTokens: 1500, timeoutMs: 50_000 });
      parsed = parseVerifierOutput(r.text); inTok += r.inputTokens; outTok += r.outputTokens; ms += r.ms;
    }
    logUsage(pre.userId, { context: "conseiller : vérification", inputTokens: inTok, outputTokens: outTok });
    if (!parsed) throw new AdvisorError("parse", "La relecture n'a pas pu être exploitée. Votre texte est conservé : vous pouvez réessayer.");
    const { alerts, interpretations, established } = mapVerifierToAlerts({ parsed, text, profile: ctx.profile });
    return NextResponse.json({ alerts, interpretations, established, verifiedAt: Date.now(), meta: { model, ms, inputTokens: inTok, outputTokens: outTok, disclaimer: DISCLAIMER } });
  } catch (e) {
    console.error("[conseiller] vérification :", e?.code ?? "inconnue");
    const { body: b, status } = errorBody(e);
    return NextResponse.json(b, { status });
  }
}
