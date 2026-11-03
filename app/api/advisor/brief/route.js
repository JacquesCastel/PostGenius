import { NextResponse } from "next/server";
import { logUsage } from "@/lib/usage";
import { advisorPreflight, readBody } from "@/lib/advisorRoute";
import { BRIEF_SYSTEM, briefUserPrompt, parseBriefAnalysis, needsBriefAnalysis, MAX_BRIEF_CHARS } from "@/lib/advisorBrief";
import { callClaude, MODELS, errorBody, AdvisorError } from "@/lib/advisorLlm";

// Analyse légère du brief avant la rédaction : contradiction factuelle centrale ou information essentielle manquante.
// Un seul appel court (modèle rapide), et aucun appel du tout pour un sujet purement thématique.
export const maxDuration = 30;

export async function POST(req) {
  const pre = await advisorPreflight(req, { bucket: "brief", limit: 60 });
  if (pre.response) return pre.response;
  const { theme, expertise } = await readBody(req);
  const brief = typeof theme === "string" ? theme.trim().slice(0, MAX_BRIEF_CHARS) : "";
  if (!brief) return NextResponse.json({ error: "Décrivez votre sujet." }, { status: 400 });
  if (!needsBriefAnalysis(brief)) return NextResponse.json({ status: "ready", issues: [], analysed: false });
  try {
    const r = await callClaude({ model: MODELS.brief(), system: BRIEF_SYSTEM, user: briefUserPrompt(brief, typeof expertise === "string" ? expertise.slice(0, 200) : ""), maxTokens: 700, timeoutMs: 20_000 });
    logUsage(pre.userId, { context: "conseiller : brief", inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    const parsed = parseBriefAnalysis(r.text);
    if (!parsed) throw new AdvisorError("parse", "L'analyse du brief n'a pas abouti. Vous pouvez lancer la génération.");
    return NextResponse.json({ status: parsed.status, issues: parsed.issues, analysed: true });
  } catch (e) {
    console.error("[conseiller] brief :", e?.code ?? "inconnue");
    const { body, status } = errorBody(e);
    return NextResponse.json(body, { status });
  }
}
