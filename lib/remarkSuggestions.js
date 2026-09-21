import { prisma } from "./db";
import { logUsage } from "./usage";
import { getRemarks, addRemark } from "./remarks";
import { maxSemanticSimilarity } from "./editorial/embeddings";
import {
  comparePair,
  statSuggestions,
  buildExcerpts,
  suggestionPrompt,
  parseLlmSuggestions,
  sameQuote,
  MIN_MODIFIED,
  NEW_TRIGGER,
  MAX_PAIRS,
} from "./editLearning";

// Suggestions de remarques déduites des modifications que l'utilisateur apporte aux posts
// générés (voir lib/editLearning.js pour la détection). Une suggestion n'est jamais appliquée
// seule : l'utilisateur l'accepte (elle devient une remarque) ou l'ignore.

const MAX_PENDING = 3;
// Une suggestion de fond aussi proche (embeddings) d'une remarque ou d'une suggestion déjà
// connue est une reformulation du même motif, pas une nouvelle habitude. Seuil étalonné sur
// des paires réelles : reformulations 0,59 à 0,82 ; habitudes différentes 0,36 à 0,50.
const SAME_HABIT_SIMILARITY = 0.55;

export async function getPendingSuggestions(userId) {
  return prisma.remarkSuggestion.findMany({
    where: { userId, status: "proposée" },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, evidence: true },
  });
}

async function askModel(userId, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_CHAT_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("API Claude " + res.status);
  const data = await res.json();
  logUsage(userId, {
    kind: "claude",
    context: "analyse des modifications",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  });
  return data.content?.[0]?.text ?? "";
}

// Analyse les derniers posts modifiés et enregistre de nouvelles suggestions si un motif
// se dégage. Ne fait rien tant que les conditions ne sont pas réunies : au moins
// MIN_MODIFIED posts modifiés, dont NEW_TRIGGER depuis la dernière analyse.
export async function refreshSuggestions(userId) {
  const pending = await getPendingSuggestions(userId);
  if (pending.length >= MAX_PENDING) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { remarkAnalysisAt: true } });
  if (!user) return;

  const drafts = await prisma.draft.findMany({
    where: { userId, generatedText: { not: null } },
    orderBy: { createdAt: "desc" },
    take: MAX_PAIRS,
    select: { text: true, generatedText: true, createdAt: true },
  });
  const modified = drafts
    .map((d) => ({ ...comparePair(d.generatedText, d.text), createdAt: d.createdAt }))
    .filter((p) => p.changed);
  if (modified.length < MIN_MODIFIED) return;

  const previous = user.remarkAnalysisAt;
  const fresh = modified.filter((p) => !previous || p.createdAt > previous);
  if (fresh.length < NEW_TRIGGER) return;

  // Réservation : deux chargements simultanés ne lancent qu'une seule analyse.
  const claim = await prisma.user.updateMany({
    where: { id: userId, remarkAnalysisAt: previous },
    data: { remarkAnalysisAt: new Date() },
  });
  if (claim.count !== 1) return;

  try {
    const [remarks, past] = await Promise.all([
      getRemarks(userId),
      prisma.remarkSuggestion.findMany({ where: { userId }, select: { text: true, key: true, quote: true, status: true } }),
    ]);
    const knownTexts = [...remarks.map((r) => r.text), ...past.map((s) => s.text)];
    const isKnownText = (t) => knownTexts.some((k) => k.toLowerCase() === t.toLowerCase());
    const doneKeys = new Set(past.filter((s) => s.key !== "llm").map((s) => s.key));

    // Règles chiffrées : un motif déjà proposé (accepté ou refusé) n'est pas reproposé.
    const candidates = statSuggestions(modified).filter((s) => !doneKeys.has(s.key) && !isKnownText(s.text));

    // Motifs de fond ou de style : modèle de langage, filtré par citation vérifiable.
    // Un seul motif de fond en attente à la fois (le modèle reformule volontiers le même
    // motif), et un motif déjà proposé n'est pas reproposé s'il cite la même phrase.
    const llmPending = past.some((s) => s.key === "llm" && s.status === "proposée");
    const pastQuotes = past.filter((s) => s.quote).map((s) => s.quote);
    if (process.env.ANTHROPIC_API_KEY && !llmPending) {
      const excerpts = buildExcerpts(modified);
      if (excerpts.length >= 2) {
        try {
          const raw = await askModel(userId, suggestionPrompt({ excerpts, known: knownTexts }));
          const fromModel = parseLlmSuggestions(raw, excerpts).filter(
            (s) => !isKnownText(s.text) && !pastQuotes.some((q) => sameQuote(q, s.quote))
          );
          for (const s of fromModel) {
            // null = embeddings indisponibles : on s'en remet à la garde par citation ci-dessus
            const similarity = await maxSemanticSimilarity(s.text, knownTexts);
            if (similarity !== null && similarity >= SAME_HABIT_SIMILARITY) continue;
            candidates.push(s);
            break; // un seul motif de fond à la fois
          }
        } catch (e) {
          console.error("Analyse des modifications (modèle) :", e.message);
        }
      }
    }

    for (const s of candidates.slice(0, MAX_PENDING - pending.length)) {
      await prisma.remarkSuggestion.create({
        data: { userId, text: s.text.slice(0, 300), evidence: s.evidence.slice(0, 300), key: s.key, quote: s.quote ?? null },
      });
    }
  } catch (e) {
    // On libère la réservation pour réessayer au prochain chargement.
    console.error("Analyse des modifications :", e.message);
    await prisma.user.updateMany({ where: { id: userId }, data: { remarkAnalysisAt: previous } });
  }
}

// Accepte (la suggestion devient une remarque) ou ignore une suggestion.
export async function respondToSuggestion(userId, id, action) {
  const suggestion = await prisma.remarkSuggestion.findFirst({ where: { id, userId, status: "proposée" } });
  if (!suggestion) return { error: "Suggestion introuvable.", status: 404 };

  if (action === "accept") {
    const added = await addRemark(userId, suggestion.text);
    // Doublon : la remarque existe déjà, la suggestion est simplement close.
    if (added.error && added.code !== "duplicate") return added;
    await prisma.remarkSuggestion.update({
      where: { id },
      data: { status: "acceptée", respondedAt: new Date() },
    });
    return { remark: added.remark ?? null };
  }
  if (action === "dismiss") {
    await prisma.remarkSuggestion.update({ where: { id }, data: { status: "ignorée", respondedAt: new Date() } });
    return { ok: true };
  }
  return { error: "Action invalide.", status: 400 };
}
