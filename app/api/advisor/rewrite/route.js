import { NextResponse } from "next/server";
import { logUsage } from "@/lib/usage";
import { advisorPreflight, readBody } from "@/lib/advisorRoute";
import { REWRITE_SYSTEM, rewriteUserPrompt, cleanReplacement } from "@/lib/advisorRewrite";
import { locatePassage } from "@/lib/advisorReview";
import { MAX_TEXT_CHARS } from "@/lib/advisorVerify";
import { callClaude, MODELS, errorBody, AdvisorError } from "@/lib/advisorLlm";

// Reformulation prudente d'UN passage signalé. Renvoie une proposition : le texte n'est jamais modifié ici, ni en silence côté interface.
export const maxDuration = 45;

export async function POST(req) {
  const pre = await advisorPreflight(req, { bucket: "rewrite", limit: 40 });
  if (pre.response) return pre.response;
  const body = await readBody(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const quote = typeof body.quote === "string" ? body.quote.trim().slice(0, 400) : "";
  const problem = typeof body.problem === "string" ? body.problem.trim().slice(0, 300) : "";
  if (!text || !quote) return NextResponse.json({ error: "Texte et passage requis." }, { status: 400 });
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "Le texte est trop long." }, { status: 413 });
  if (!locatePassage(text, quote)) return NextResponse.json({ error: "Ce passage n'est plus dans le texte." }, { status: 409 });
  try {
    const r = await callClaude({ model: MODELS.rewrite(), system: REWRITE_SYSTEM, user: rewriteUserPrompt({ text, quote, problem }), maxTokens: 500, temperature: 0.2, timeoutMs: 30_000 });
    logUsage(pre.userId, { context: "conseiller : reformulation", inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    const replacement = cleanReplacement(r.text, quote);
    if (!replacement) throw new AdvisorError("parse", "Aucune reformulation exploitable. Vous pouvez modifier le passage vous-même.");
    return NextResponse.json({ replacement });
  } catch (e) {
    console.error("[conseiller] reformulation :", e?.code ?? "inconnue");
    const { body: b, status } = errorBody(e);
    return NextResponse.json(b, { status });
  }
}
