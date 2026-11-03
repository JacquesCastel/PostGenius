import { NextResponse } from "next/server";
import { logUsage } from "@/lib/usage";
import { advisorPreflight, readBody } from "@/lib/advisorRoute";
import { REWRITE_SYSTEM, rewriteAllUserPrompt, cleanReplacements, MAX_BATCH } from "@/lib/advisorRewrite";
import { locatePassage } from "@/lib/advisorReview";
import { MAX_TEXT_CHARS } from "@/lib/advisorVerify";
import { callClaude, MODELS, errorBody, AdvisorError } from "@/lib/advisorLlm";

// Reformulation prudente de TOUS les ajouts signalés, en un appel. Renvoie des propositions : le texte n'est jamais modifié ici,
// et l'interface n'applique que celles que l'utilisateur accepte.
export const maxDuration = 60;

export async function POST(req) {
  const pre = await advisorPreflight(req, { bucket: "rewrite", limit: 40 });
  if (pre.response) return pre.response;
  const body = await readBody(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((x) => ({ id: typeof x?.id === "string" ? x.id.slice(0, 40) : "", quote: typeof x?.quote === "string" ? x.quote.trim().slice(0, 400) : "", problem: typeof x?.problem === "string" ? x.problem.trim().slice(0, 300) : "" }))
    .filter((x) => x.quote && locatePassage(text, x.quote))
    .slice(0, MAX_BATCH);
  if (!text || !items.length) return NextResponse.json({ error: "Aucun passage à reformuler dans le texte." }, { status: 400 });
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "Le texte est trop long." }, { status: 413 });
  try {
    const r = await callClaude({ model: MODELS.rewrite(), system: REWRITE_SYSTEM, user: rewriteAllUserPrompt({ text, items }), maxTokens: 1200, temperature: 0.2, timeoutMs: 45_000 });
    logUsage(pre.userId, { context: "conseiller : reformulation", inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    const proposals = cleanReplacements(r.text, items);
    if (!proposals.length) throw new AdvisorError("parse", "Aucune reformulation exploitable. Vous pouvez modifier les passages vous-même.");
    return NextResponse.json({ proposals });
  } catch (e) {
    console.error("[conseiller] reformulation groupée :", e?.code ?? "inconnue");
    const { body: b, status } = errorBody(e);
    return NextResponse.json(b, { status });
  }
}
