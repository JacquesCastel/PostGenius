import { prisma } from "./db";
import { logUsage } from "./usage";
import { icpText, postUrlOfComment, scorePrompt, normalizeScores, SCORE_SYSTEM, MAX_SCORE_BATCH } from "./leadsText";

// Base de leads (partie serveur) : enregistrement des commentateurs d'une page, lecture facultative de leur nom, qualification par l'IA.

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";
const PERSON_URN = /^urn:li:person:[A-Za-z0-9_-]+$/;
const MAX_PER_PASS = 20;

// Nom et poste d'une personne, tels que LinkedIn les fournit (vérifié sur une vraie page). Sinon null : le lead reste sans nom, modifiable à la main.
let lookupDeniedUntil = 0; // accès aux profils refusé : on cesse de demander (chaque refus coûte un appel du quota)

async function lookupPerson(token, actorUrn) {
  if (Date.now() < lookupDeniedUntil) return null;
  const id = actorUrn.slice("urn:li:person:".length);
  try {
    const res = await fetch(`${LI_API}/v2/people/(id:${encodeURIComponent(id)})?projection=(localizedFirstName,localizedLastName,localizedHeadline)`, {
      headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      lookupDeniedUntil = Date.now() + (res.status === 429 ? 3600_000 : 6 * 3600_000);
      return null;
    }
    const j = await res.json();
    const name = [j.localizedFirstName, j.localizedLastName].filter(Boolean).join(" ").trim();
    return name || j.localizedHeadline ? { name: name || null, headline: j.localizedHeadline || null } : null;
  } catch {
    return null;
  }
}

// Enregistre les auteurs des nouveaux commentaires d'une page (un lead par commentaire). `skipActors` : la page et ses administrateurs.
export async function captureLeads({ userId, token, comments, skipActors = [] }) {
  let created = 0;
  const people = new Map(); // un seul appel par personne et par passage
  for (const c of comments.slice(0, MAX_PER_PASS)) { // c : { urn, info } avec info = lecture du commentaire (texte, auteur, parent)
    try {
      if (await prisma.lead.findUnique({ where: { userId_commentUrn: { userId, commentUrn: c.urn } }, select: { id: true } })) continue;
      const info = c.info;
      const actor = typeof info?.actor === "string" ? info.actor : null;
      if (!info || (!info.text && !actor)) continue;
      if (actor && skipActors.includes(actor)) continue;
      if (actor && !PERSON_URN.test(actor)) continue; // commentaire d'une organisation
      if (info.parent) continue; // une réponse dans un fil : le commentaire d'origine suffit
      const known = actor ? await prisma.lead.findFirst({ where: { userId, actorUrn: actor, NOT: { name: null } }, select: { name: true, headline: true, company: true, profileUrl: true } }) : null;
      const who = known ? { name: known.name, headline: known.headline } : actor ? people.get(actor) ?? (await lookupPerson(token, actor)) : null;
      if (actor) people.set(actor, who);
      await prisma.lead.create({
        data: { userId, source: "page_comment", actorUrn: actor, name: who?.name ?? null, headline: who?.headline ?? null, company: known?.company ?? null, commentText: info.text.slice(0, 1500) || null, commentUrn: c.urn, postUrl: postUrlOfComment(c.urn) },
      });
      created++;
    } catch (e) {
      console.warn("[leads] enregistrement impossible :", e.message);
    }
  }
  return created;
}

async function claudeJson({ userId, system, prompt }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 2500, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error("API Claude indisponible (" + res.status + ")");
  const data = await res.json();
  logUsage(userId, { context: "qualification des leads", inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 });
  const m = (data.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Réponse non parsable");
  return JSON.parse(m[0]);
}

// Qualifie jusqu'à MAX_SCORE_BATCH leads pas encore notés (ou tous ceux demandés). Renvoie le nombre de leads notés.
export async function scoreLeads(userId, { ids, all = false } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { leadIcp: true, targetAudience: true } });
  const icp = icpText(user);
  if (!icp) throw Object.assign(new Error("Décrivez d'abord votre client idéal."), { status: 400 });
  const where = { userId, ...(ids ? { id: { in: ids } } : all ? {} : { level: null }) };
  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: MAX_SCORE_BATCH, select: { id: true, name: true, headline: true, company: true, commentText: true } });
  if (!leads.length) return { scored: 0, left: 0 };
  const scores = normalizeScores(await claudeJson({ userId, system: SCORE_SYSTEM, prompt: scorePrompt(icp, leads) }), leads.map((l) => l.id));
  for (const [id, s] of scores) await prisma.lead.update({ where: { id }, data: { level: s.level, reason: s.reason, scoredAt: new Date() } });
  const left = await prisma.lead.count({ where: { userId, level: null } });
  return { scored: scores.size, left };
}
