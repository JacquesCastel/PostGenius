import { prisma } from "./db";
import { checkAccess, checkPostQuota } from "./gating";
import { overlayProfile } from "./contextOverlay";
import { generateText } from "./campaign";
import { parseBrief, briefVoiceBlock, norm } from "./campaignBrief";
import { itemsFromBrief, allowedUrls, cleanItemPatch, shiftPlan, parisInstant, planWarnings, itemPrompt, applyUrl, MAX_ITEMS } from "./campaignPlan";

export class PlanError extends Error {
  constructor(message, status = 400, extra = undefined) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

async function ownCampaign(userId, id) {
  const c = await prisma.campaign.findFirst({ where: { id, userId } });
  if (!c) throw new PlanError("Campagne introuvable.", 404);
  return c;
}
async function ownItem(userId, campaignId, itemId) {
  const it = await prisma.campaignPost.findFirst({ where: { id: itemId, campaignId, userId } });
  if (!it) throw new PlanError("Publication introuvable.", 404);
  return it;
}
const view = (i) => ({
  id: i.id, position: i.position, ref: i.ref, account: i.account, kind: i.kind, target: i.target, date: i.date, objective: i.objective, angle: i.angle,
  cta: i.cta, url: i.url, format: i.format, visual: i.visual, media: i.media, toConfirm: i.toConfirm, status: i.status,
  draft: i.draft ? { id: i.draft.id, text: i.draft.text, status: i.draft.status, scheduledAt: i.draft.scheduledAt, target: i.draft.target } : null,
});

// Crée les lignes du plan à partir du calendrier du brief (sans effet si le plan existe déjà)
export async function ensurePlanFromBrief(userId, campaignId) {
  const c = await ownCampaign(userId, campaignId);
  if (await prisma.campaignPost.count({ where: { campaignId } })) return 0;
  const items = itemsFromBrief(parseBrief(c.brief));
  if (!items.length) return 0;
  await prisma.campaignPost.createMany({ data: items.map((i) => ({ ...i, campaignId, userId })) });
  return items.length;
}

async function orgsOf(userId) {
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgAccounts: true } }).catch(() => null);
  try { return JSON.parse(acc?.orgAccounts ?? "[]").map((o) => ({ urn: o.urn, name: o.name })); } catch { return []; }
}

export async function getPlan(userId, campaignId) {
  const c = await ownCampaign(userId, campaignId);
  const brief = parseBrief(c.brief);
  const items = await prisma.campaignPost.findMany({ where: { campaignId, userId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { draft: { select: { id: true, text: true, status: true, scheduledAt: true, target: true } } } });
  const orgs = await orgsOf(userId);
  const accounts = (brief?.accounts?.length ? brief.accounts.map((a) => ({ label: a.label, kind: a.kind })) : [...new Set(items.map((i) => i.account))].map((label) => ({ label, kind: items.find((i) => i.account === label)?.kind ?? "person" })))
    .map((a) => ({ ...a, target: items.find((i) => norm(i.account) === norm(a.label) && i.target)?.target ?? null }));
  return {
    campaign: { id: c.id, name: c.name },
    items: items.map(view),
    accounts,
    orgs,
    allowedUrls: allowedUrls(brief),
    warnings: planWarnings(items, brief),
  };
}

export async function addItem(userId, campaignId, body) {
  const c = await ownCampaign(userId, campaignId);
  const brief = parseBrief(c.brief);
  const n = await prisma.campaignPost.count({ where: { campaignId } });
  if (n >= MAX_ITEMS) throw new PlanError(`Un plan compte ${MAX_ITEMS} publications au plus.`);
  const patch = cleanItemPatch({ ...body }, { allowed: allowedUrls(brief) });
  const account = patch.account || brief?.accounts?.[0]?.label || "Profil";
  const kind = brief?.accounts?.find((a) => norm(a.label) === norm(account))?.kind ?? "person";
  const last = await prisma.campaignPost.findFirst({ where: { campaignId }, orderBy: { position: "desc" } });
  const sibling = await prisma.campaignPost.findFirst({ where: { campaignId, userId, account } });
  const item = await prisma.campaignPost.create({
    data: { ...patch, account, kind, target: sibling?.target ?? (kind === "person" ? "person" : null), ref: patch.ref || `P${String(n + 1).padStart(2, "0")}`, campaignId, userId, position: (last?.position ?? -1) + 1 },
  });
  return view(item);
}

export async function updateItem(userId, campaignId, itemId, body) {
  const c = await ownCampaign(userId, campaignId);
  await ownItem(userId, campaignId, itemId);
  let patch;
  try {
    patch = cleanItemPatch(body, { allowed: allowedUrls(parseBrief(c.brief)) });
  } catch (e) {
    throw new PlanError(e.message);
  }
  if (!Object.keys(patch).length) throw new PlanError("Rien à modifier.");
  const item = await prisma.campaignPost.update({ where: { id: itemId }, data: patch, include: { draft: true } });
  // La date proposée suit sur le post déjà rédigé, tant qu'il n'est pas publié
  if (item.draft && "date" in patch && item.draft.status !== "publié") {
    const at = parisInstant(patch.date, (await prisma.user.findUnique({ where: { id: userId }, select: { publishTime: true } }))?.publishTime ?? "09:00");
    await prisma.draft.update({ where: { id: item.draft.id }, data: { scheduledAt: at } });
  }
  return view(item);
}

export async function deleteItem(userId, campaignId, itemId) {
  await ownCampaign(userId, campaignId);
  const it = await ownItem(userId, campaignId, itemId);
  await prisma.campaignPost.delete({ where: { id: it.id } });
}

export async function shiftItems(userId, campaignId, newStart) {
  await ownCampaign(userId, campaignId);
  const items = await prisma.campaignPost.findMany({ where: { campaignId, userId }, include: { draft: true } });
  let moves;
  try {
    moves = shiftPlan(items, newStart);
  } catch (e) {
    throw new PlanError(e.message);
  }
  const time = (await prisma.user.findUnique({ where: { id: userId }, select: { publishTime: true } }))?.publishTime ?? "09:00";
  await prisma.$transaction(
    moves.flatMap((m) => {
      const it = items.find((i) => i.id === m.id);
      const ops = [prisma.campaignPost.update({ where: { id: m.id }, data: { date: m.date } })];
      if (it.draft && it.draft.status !== "publié") ops.push(prisma.draft.update({ where: { id: it.draft.id }, data: { scheduledAt: m.date ? parisInstant(m.date, time) : null } }));
      return ops;
    })
  );
}

// Associe un compte du brief à une page LinkedIn (ou au profil) : toutes ses publications suivent
export async function mapAccount(userId, campaignId, { account, target }) {
  await ownCampaign(userId, campaignId);
  if (target !== "person") {
    const orgs = await orgsOf(userId);
    if (!orgs.some((o) => o.urn === target)) throw new PlanError("Page LinkedIn introuvable : vérifiez la connexion de votre page.");
  }
  const items = await prisma.campaignPost.findMany({ where: { campaignId, userId } });
  const ids = items.filter((i) => norm(i.account) === norm(account)).map((i) => i.id);
  if (!ids.length) throw new PlanError("Compte inconnu dans ce plan.");
  await prisma.campaignPost.updateMany({ where: { id: { in: ids } }, data: { target } });
  // Les posts déjà rédigés et non publiés suivent le compte
  await prisma.draft.updateMany({ where: { campaignPostId: { in: ids }, status: { not: "publié" } }, data: { target } });
}

// Rédige une publication du plan : brief + voix du compte + consignes de la ligne ; le lien est ajouté par le code ;
// le post reste « à valider » (jamais programmé ni publié seul).
export async function generateItem(userId, campaignId, itemId) {
  const c = await ownCampaign(userId, campaignId);
  const item = await ownItem(userId, campaignId, itemId);
  const access = await checkAccess(userId);
  if (!access.ok) throw new PlanError(access.error, 403, { code: access.code });
  const existing = await prisma.draft.findFirst({ where: { campaignPostId: item.id } });
  if (existing?.status === "publié") throw new PlanError("Cette publication est déjà publiée.", 409);
  if (!existing) {
    const quota = await checkPostQuota(userId);
    if (!quota.ok) throw new PlanError(quota.error, 403, { code: "posts_limit", limit: quota.limit, upgradeTo: quota.upgradeTo });
  }
  if (item.kind === "org" && (!item.target || item.target === "person")) {
    throw new PlanError(`Associez d'abord le compte « ${item.account} » à une page LinkedIn.`);
  }
  if (!item.angle && !item.objective) throw new PlanError("Indiquez un sujet ou un objectif pour cette publication.");

  const brief = parseBrief(c.brief);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const ctxRow = c.contextId ? await prisma.context.findFirst({ where: { id: c.contextId, userId } }) : null;
  const author = ctxRow ? overlayProfile(user, ctxRow) : user;
  let pageName = "";
  if (item.kind === "org") pageName = (await orgsOf(userId)).find((o) => o.urn === item.target)?.name ?? item.account;

  // Autres publications proches (une semaine avant ou après) : angle distinct, jamais le même sujet
  const siblings = await prisma.campaignPost.findMany({ where: { campaignId, userId, NOT: { id: item.id } } });
  const near = siblings.filter((s) => s.date && item.date && Math.abs(Date.parse(s.date) - Date.parse(item.date)) <= 7 * 86400000);
  const context = `${c.context ?? ""}${briefVoiceBlock(brief, item.kind)}${itemPrompt(item, { others: near })}`;
  const gen = await generateText(author, item.angle || item.objective, context, [], c.mood, null, { kind: item.kind, pageName, brandVoice: author.brandVoice }, ctxRow?.id ?? null);
  const text = applyUrl(gen.text, item);

  const when = item.date ? parisInstant(item.date, user.publishTime ?? "09:00") : null;
  const data = { text, generatedText: text, scheduledAt: when, target: item.target ?? "person" };
  let draft;
  if (existing) draft = await prisma.draft.update({ where: { id: existing.id }, data: { ...data, status: when ? "à valider" : "brouillon" } });
  else {
    draft = await prisma.draft.create({
      data: {
        ...data, userId, type: "simple", theme: c.name, expertise: user.expertise ?? "", tone: user.tone || "Professionnel", maxChars: user.defaultMaxChars || 1300,
        status: when ? "à valider" : "brouillon", auto: false, campaignId: c.id, contextId: ctxRow?.id ?? null, campaignPostId: item.id,
      },
    });
  }
  const updated = await prisma.campaignPost.update({ where: { id: item.id }, data: { status: "généré" }, include: { draft: true } });
  return view(updated);
}
