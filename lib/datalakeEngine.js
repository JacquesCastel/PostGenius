import { prisma } from "./db";
import { logUsage } from "./usage";
import { rateLimit } from "./ratelimit";
import { checkAccess, checkKnowledgeQuota } from "./gating";
import { KnowledgeError, sourceScope } from "./knowledge";
import { parseFacts, parseInsights } from "./knowledgeText";
import { getContextFor } from "./contexts";
import { datalakeBlockFor } from "./datalakeBlock";
import { ELEMENT_KINDS, MAX_ELEMENTS, norm } from "./languageElements";
import {
  BRIEF_SYSTEM, CHAT_SYSTEM, briefPrompt, chatPrompt, normalizeBrief, normalizeChat, cleanRememberText, REMEMBER_KINDS, MESSAGE_MAX,
} from "./datalakeEngineText";

// Moteur du datalake (partie serveur) : synthèse de ce que le moteur a appris (mise en cache, signalée « à actualiser » quand les
// sources changent), échange avec l'auteur et enregistrement de ce qu'il précise. Rien n'est retenu sans son accord.

export const PRECISION_TITLE = "Précisions de l'auteur (échanges avec le moteur)";
const MAX_PRECISIONS = 30;
const scopeWhere = (contextId) => ({ contextId: contextId ?? null });

async function scopeContext(userId, raw) {
  const id = raw && raw !== "main" ? String(raw) : null;
  if (!id) return null;
  const ctx = await getContextFor(userId, id);
  if (!ctx) throw new KnowledgeError("Entreprise introuvable.", 404);
  return ctx.id;
}

async function guard(userId) {
  if (!process.env.ANTHROPIC_API_KEY) throw new KnowledgeError("Moteur indisponible : clé IA manquante sur le serveur.", 500);
  const access = await checkAccess(userId);
  if (!access.ok) throw new KnowledgeError(access.error, 403, access.code);
}

async function claudeJson({ userId, system, prompt, maxTokens }) {
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error("API Claude indisponible (" + res.status + ")");
    const data = await res.json();
    logUsage(userId, { context: "moteur du datalake", inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 });
    try {
      const m = (data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Réponse non parsable");
      return JSON.parse(m[0]);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

// Sources et éléments de langage de l'entreprise + signature (change dès qu'une source est ajoutée, retirée ou modifiée)
async function material(userId, contextId) {
  const [rows, elements] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where: { userId, ...sourceScope(contextId) },
      select: { title: true, summary: true, facts: true, insights: true, createdAt: true, charCount: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.languageElement.findMany({ where: { userId, ...scopeWhere(contextId) }, select: { kind: true, text: true }, orderBy: { createdAt: "asc" }, take: MAX_ELEMENTS }),
  ]);
  const sources = rows.filter((s) => s.summary || parseFacts(s.facts).length).map((s) => ({ title: s.title, summary: s.summary, facts: parseFacts(s.facts), insights: parseInsights(s.insights), at: s.createdAt.getTime(), chars: s.charCount }));
  const stamp = `${sources.length}:${sources.reduce((n, s) => Math.max(n, s.at), 0)}:${sources.reduce((n, s) => n + s.chars, 0)}:${elements.length}`;
  return { sources, elements, stamp };
}

// Synthèse en cache : { brief, updatedAt, stale, sourceCount }
export async function getEngine(userId, rawContextId) {
  const contextId = await scopeContext(userId, rawContextId);
  const [cached, mat] = await Promise.all([prisma.datalakeBrief.findFirst({ where: { userId, ...scopeWhere(contextId) }, orderBy: { updatedAt: "desc" } }), material(userId, contextId)]);
  return { brief: cached?.content ?? null, updatedAt: cached?.updatedAt ?? null, stale: Boolean(cached) && cached.stamp !== mat.stamp, sourceCount: mat.sources.length };
}

export async function generateBrief(userId, rawContextId) {
  await guard(userId);
  const contextId = await scopeContext(userId, rawContextId);
  if (!rateLimit(`engine-brief:${userId}`, { limit: 10, windowMs: 3600_000 })) throw new KnowledgeError("Trop de synthèses d'un coup. Réessayez dans quelques minutes.", 429);
  const mat = await material(userId, contextId);
  if (!mat.sources.length) throw new KnowledgeError("Ajoutez d'abord au moins une source : le moteur n'a encore rien lu.", 400);
  let brief;
  try {
    const raw = await claudeJson({ userId, system: BRIEF_SYSTEM, prompt: briefPrompt(mat), maxTokens: 1800 });
    brief = normalizeBrief(raw, mat.sources.flatMap((s) => s.facts).join("\n"));
    if (!brief.headline && !brief.business) throw new Error("Synthèse vide");
  } catch (e) {
    console.error("[moteur] synthèse impossible :", e.message);
    throw new KnowledgeError("La synthèse a échoué. Réessayez dans un instant.", 502);
  }
  const existing = await prisma.datalakeBrief.findFirst({ where: { userId, ...scopeWhere(contextId) }, select: { id: true } });
  if (existing) await prisma.datalakeBrief.update({ where: { id: existing.id }, data: { content: brief, stamp: mat.stamp } });
  else await prisma.datalakeBrief.create({ data: { userId, contextId, content: brief, stamp: mat.stamp } });
  return getEngine(userId, contextId);
}

// Un tour d'échange : { reply, remember: [{ kind, text }] }. Rien n'est enregistré ici.
export async function chatWithEngine(userId, rawContextId, { message, history }) {
  await guard(userId);
  const contextId = await scopeContext(userId, rawContextId);
  const text = String(message ?? "").trim();
  if (!text) throw new KnowledgeError("Écrivez votre message.", 400);
  if (text.length > MESSAGE_MAX) throw new KnowledgeError(`Message trop long (${MESSAGE_MAX} caractères au plus).`, 400);
  if (!rateLimit(`engine-chat:${userId}`, { limit: 40, windowMs: 3600_000 })) throw new KnowledgeError("Trop de messages pour l'instant. Réessayez dans quelques minutes.", 429);
  const cached = await prisma.datalakeBrief.findFirst({ where: { userId, ...scopeWhere(contextId) }, orderBy: { updatedAt: "desc" }, select: { content: true } });
  const datalake = await datalakeBlockFor(userId, text, contextId);
  try {
    const raw = await claudeJson({ userId, system: CHAT_SYSTEM, prompt: chatPrompt({ brief: cached?.content ?? null, datalake, history, message: text }), maxTokens: 900 });
    const out = normalizeChat(raw);
    if (!out.reply) throw new Error("Réponse vide");
    return out;
  } catch (e) {
    console.error("[moteur] échange impossible :", e.message);
    throw new KnowledgeError("Le moteur n'a pas pu répondre. Réessayez dans un instant.", 502);
  }
}

// Enregistre ce que l'auteur a accepté de faire retenir : élément de langage, ou précision ajoutée à la note épinglée
// « Précisions de l'auteur » (une seule note par entreprise : elle ne consomme qu'une source du quota ; ses faits passent
// avant les autres sources en cas de contradiction). Renvoie { applied: "element" | "precision" }.
export async function rememberFromEngine(userId, rawContextId, { kind, text }) {
  const contextId = await scopeContext(userId, rawContextId);
  if (!REMEMBER_KINDS.includes(kind)) throw new KnowledgeError("Type inconnu.", 400);
  const final = cleanRememberText(kind, text);
  if (final.length < 3) throw new KnowledgeError("Le texte ne peut pas être vide.", 400);

  if (ELEMENT_KINDS.includes(kind)) {
    const existing = await prisma.languageElement.findMany({ where: { userId, ...scopeWhere(contextId) }, select: { kind: true, text: true } });
    if (existing.length >= MAX_ELEMENTS) throw new KnowledgeError(`Vous avez déjà ${MAX_ELEMENTS} éléments de langage : supprimez-en avant d'en ajouter.`, 400);
    if (!existing.some((e) => e.kind === kind && norm(e.text) === norm(final))) await prisma.languageElement.create({ data: { userId, contextId, kind, text: final } });
    return { applied: "element" };
  }

  const note = await prisma.knowledgeSource.findFirst({ where: { userId, kind: "note", title: PRECISION_TITLE, contextId, shared: false } });
  const facts = note ? parseFacts(note.facts) : [];
  if (facts.some((f) => norm(f) === norm(final))) return { applied: "precision" };
  if (facts.length >= MAX_PRECISIONS) throw new KnowledgeError(`Vous avez déjà ${MAX_PRECISIONS} précisions : supprimez la note « ${PRECISION_TITLE} » ou retirez-en avant d'en ajouter.`, 400);
  const nextFacts = [final, ...facts]; // la plus récente d'abord : les prompts n'en lisent que les premières
  const data = {
    text: nextFacts.map((f) => `- ${f}`).join("\n"),
    facts: JSON.stringify(nextFacts),
    summary: "Précisions et corrections apportées par l'auteur en échangeant avec le moteur. Elles prévalent sur les autres sources en cas de contradiction.",
    insights: JSON.stringify({ themes: [], vocabulary: [], positions: [] }),
  };
  data.charCount = data.text.length;
  if (note) {
    await prisma.knowledgeSource.update({ where: { id: note.id }, data });
  } else {
    const quota = await checkKnowledgeQuota(userId);
    if (!quota.ok) throw new KnowledgeError(quota.error, 403, quota.code, { limit: quota.limit, upgradeTo: quota.upgradeTo });
    await prisma.knowledgeSource.create({ data: { userId, kind: "note", title: PRECISION_TITLE, pinned: true, contextId, shared: false, ...data } });
  }
  return { applied: "precision" };
}
