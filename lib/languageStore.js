import { prisma } from "./db";
import { logUsage } from "./usage";
import { rateLimit } from "./ratelimit";
import { checkAccess } from "./gating";
import { KnowledgeError, sourceScope } from "./knowledge";
import { parseInsights } from "./knowledgeText";
import { getContextFor } from "./contexts";
import { recentPostExcerpts } from "./datalakePosts";
import { findOrCreatePillar, getPillars } from "./editorial/pillars";
import {
  ELEMENT_KINDS, MAX_ELEMENTS, MAX_PENDING, LINE_MAX, PROPOSAL_SYSTEM,
  proposalPrompt, normalizeProposals, appendEditorialLine, norm,
} from "./languageElements";

const scopeWhere = (contextId) => ({ contextId: contextId ?? null });
const view = (r) => ({ id: r.id, kind: r.kind, text: r.text, detail: r.detail ?? null, origin: r.origin ?? null, createdAt: r.createdAt });

// Éléments validés d'une entreprise (nul = principale) : jamais bloquant pour la rédaction
export async function elementsFor(userId, contextId = null) {
  if (!userId) return [];
  try {
    return await prisma.languageElement.findMany({ where: { userId, ...scopeWhere(contextId) }, select: { kind: true, text: true }, orderBy: { createdAt: "asc" }, take: MAX_ELEMENTS });
  } catch (e) {
    console.error("[langage] lecture impossible :", e.message);
    return [];
  }
}

export async function listLanguage(userId, contextId = null) {
  const [elements, proposals] = await Promise.all([
    prisma.languageElement.findMany({ where: { userId, ...scopeWhere(contextId) }, orderBy: { createdAt: "asc" } }),
    prisma.languageProposal.findMany({ where: { userId, ...scopeWhere(contextId), status: "proposée" }, orderBy: { createdAt: "asc" } }),
  ]);
  return { elements: elements.map(view), proposals: proposals.map(view) };
}

// Lit le datalake de l'entreprise et propose des éléments de langage (jamais appliqués seuls)
export async function proposeLanguage(userId, contextId = null) {
  if (!process.env.ANTHROPIC_API_KEY) throw new KnowledgeError("Analyse indisponible : clé IA manquante sur le serveur.", 500);
  const access = await checkAccess(userId);
  if (!access.ok) throw new KnowledgeError(access.error, 403, access.code);
  const ctx = contextId ? await getContextFor(userId, contextId) : null;
  if (contextId && !ctx) throw new KnowledgeError("Entreprise introuvable.", 404);
  const pending = await prisma.languageProposal.count({ where: { userId, ...scopeWhere(ctx?.id ?? null), status: "proposée" } });
  if (pending >= MAX_PENDING) throw new KnowledgeError("Traitez d'abord les propositions en attente (ajouter ou ignorer).", 400);
  const sources = await prisma.knowledgeSource.findMany({
    where: { userId, ...sourceScope(ctx?.id ?? null) },
    select: { title: true, summary: true, insights: true, text: true },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  const ready = sources.filter((s) => s.summary);
  if (!ready.length) throw new KnowledgeError("Ajoutez d'abord au moins une source : l'IA propose des éléments de langage à partir de ce que vous avez déposé.", 400);
  if (!rateLimit(`language:${userId}`, { limit: 10, windowMs: 3600_000 })) throw new KnowledgeError("Trop de demandes pour l'instant. Réessayez dans une heure.", 429);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const { overlayProfile } = await import("./contextOverlay");
  const profile = overlayProfile(user, ctx);
  const [elements, pillars, past] = await Promise.all([
    prisma.languageElement.findMany({ where: { userId, ...scopeWhere(ctx?.id ?? null) }, select: { kind: true, text: true } }),
    getPillars(userId),
    prisma.languageProposal.findMany({ where: { userId, ...scopeWhere(ctx?.id ?? null) }, select: { kind: true, text: true } }),
  ]);
  const prompt = proposalPrompt({
    profile,
    sources: ready.map((s) => ({ title: s.title, summary: s.summary, insights: parseInsights(s.insights) })),
    existing: { elements, pillars: pillars.map((p) => p.name) },
    posts: await recentPostExcerpts(userId, ctx?.id ?? null),
  });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 2000, system: PROPOSAL_SYSTEM, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new KnowledgeError("L'analyse a échoué. Réessayez dans un instant.", 502);
  const data = await res.json();
  logUsage(userId, { context: "éléments de langage", inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 });
  let raw;
  try {
    raw = JSON.parse((data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "null");
  } catch {
    raw = null;
  }
  const fresh = normalizeProposals(raw, {
    sourceText: ready.map((s) => s.text).join("\n"),
    knownKeys: new Set([...elements, ...past].map((e) => `${e.kind}:${norm(e.text)}`)),
    pillars: pillars.map((p) => p.name),
    titles: ready.map((s) => s.title),
  });
  if (!fresh.length) throw new KnowledgeError("L'IA n'a rien de nouveau à proposer pour l'instant. Ajoutez des sources ou réessayez plus tard.", 422);
  await prisma.languageProposal.createMany({ data: fresh.slice(0, MAX_PENDING - pending).map((p) => ({ ...p, userId, contextId: ctx?.id ?? null })) });
  return listLanguage(userId, ctx?.id ?? null);
}

// Accepte (éventuellement après modification du texte) ou ignore une proposition.
// Renvoie { applied } : où la proposition a été appliquée.
export async function respondToProposal(userId, id, { action, text }) {
  const p = await prisma.languageProposal.findFirst({ where: { id, userId } });
  if (!p) throw new KnowledgeError("Proposition introuvable.", 404);
  if (p.status !== "proposée") throw new KnowledgeError("Cette proposition a déjà été traitée.", 409);
  if (action === "ignore") {
    await prisma.languageProposal.update({ where: { id }, data: { status: "ignorée", respondedAt: new Date() } });
    return { applied: null };
  }
  if (action !== "accept") throw new KnowledgeError("Action inconnue.", 400);
  const final = String(text ?? p.text).replace(/\s+/g, " ").trim().slice(0, p.kind === "pillar" ? 40 : p.kind === "line" ? 220 : 200);
  if (final.length < 3) throw new KnowledgeError("Le texte ne peut pas être vide.", 400);
  let applied;
  if (ELEMENT_KINDS.includes(p.kind)) {
    const count = await prisma.languageElement.count({ where: { userId, ...scopeWhere(p.contextId) } });
    if (count >= MAX_ELEMENTS) throw new KnowledgeError(`Vous avez déjà ${MAX_ELEMENTS} éléments de langage : supprimez-en avant d'en ajouter.`, 400);
    const dup = (await prisma.languageElement.findMany({ where: { userId, ...scopeWhere(p.contextId), kind: p.kind }, select: { text: true } })).some((e) => norm(e.text) === norm(final));
    if (!dup) await prisma.languageElement.create({ data: { userId, contextId: p.contextId, kind: p.kind, text: final } });
    applied = "element";
  } else if (p.kind === "line") {
    const owner = p.contextId ? await prisma.context.findFirst({ where: { id: p.contextId, userId }, select: { editorialLine: true } }) : await prisma.user.findUnique({ where: { id: userId }, select: { editorialLine: true } });
    const next = appendEditorialLine(owner?.editorialLine, final, LINE_MAX);
    if (next === null) throw new KnowledgeError(`La ligne éditoriale dépasserait ${LINE_MAX} caractères : raccourcissez-la dans le profil, puis ajoutez cette phrase.`, 400);
    if (p.contextId) await prisma.context.update({ where: { id: p.contextId }, data: { editorialLine: next } });
    else await prisma.user.update({ where: { id: userId }, data: { editorialLine: next } });
    applied = "editorialLine";
  } else {
    const pillar = await findOrCreatePillar(userId, final);
    if (pillar && !pillar.description && p.detail) await prisma.editorialPillar.update({ where: { id: pillar.id }, data: { description: p.detail.slice(0, 240) } });
    applied = "pillar";
  }
  await prisma.languageProposal.update({ where: { id }, data: { status: "acceptée", respondedAt: new Date() } });
  return { applied };
}

export async function deleteElement(userId, id) {
  const { count } = await prisma.languageElement.deleteMany({ where: { id, userId } });
  if (!count) throw new KnowledgeError("Élément introuvable.", 404);
}
