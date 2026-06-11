import { prisma } from "./db";
import { getVeille } from "./veille";
import { logUsage } from "./usage";

// Moteur de campagne : génère des posts via Claude et les planifie sur les
// créneaux du rythme de publication de l'utilisateur.
// Utilisé par /api/campaign/plan (action manuelle) et par le pilote
// automatique du scheduler.

const SYSTEM_PROMPT = `Tu es un expert en copywriting LinkedIn francophone.
Tu rédiges des posts qui maximisent l'engagement : accroche forte dès la première ligne,
phrases courtes, aération, émojis avec parcimonie, question finale pour susciter les
commentaires, et 3 à 5 hashtags pertinents en fin de post.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans backticks ni texte autour.`;

// Prochains créneaux selon le rythme (1 = lundi)
export function nextPreferredSlots(profile, count = 1, from = new Date()) {
  const days = (profile?.publishDays ?? "").split(",").map(Number).filter(Boolean);
  if (!days.length) return [];
  const [h, m] = (profile?.publishTime ?? "09:00").split(":").map(Number);
  const slots = [];
  const cursor = new Date(from);
  for (let i = 0; slots.length < count && i < 400; i++) {
    const isoDay = ((cursor.getDay() + 6) % 7) + 1;
    const candidate = new Date(cursor);
    candidate.setHours(h || 9, m || 0, 0, 0);
    if (days.includes(isoDay) && candidate > from) slots.push(new Date(candidate));
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

export function userContextBlock(user) {
  let ctx = "";
  if (user.headline) ctx += `\n- Titre professionnel de l'auteur : ${user.headline}`;
  if (user.companyName) ctx += `\n- Entreprise / marque : ${user.companyName}`;
  if (user.businessDescription) ctx += `\n- Activité et proposition de valeur : ${user.businessDescription}`;
  if (user.targetAudience) ctx += `\n- Audience cible sur LinkedIn : ${user.targetAudience}`;
  if (user.market) ctx += `\n- Marché et positionnement : ${user.market}`;
  if (user.commGoals) ctx += `\n- Objectifs de communication : ${user.commGoals} (oriente le post vers ces objectifs)`;
  if (user.styleNotes) ctx += `\n- Consignes de style (À RESPECTER IMPÉRATIVEMENT) : ${user.styleNotes}`;
  return ctx;
}

function buildPrompt(user, theme, campaignContext = "", veille = null) {
  const ctx = userContextBlock(user);
  const campaignBlock = campaignContext
    ? `\n\nContexte de la campagne (brief du client — À RESPECTER) :\n${campaignContext}`
    : "";

  // Digest de la veille : l'IA peut ancrer le post sur une actualité pertinente
  let veilleBlock = "";
  let format = `{"text": "le post complet"}`;
  if (veille?.length) {
    veilleBlock = `\n\nACTUALITÉS DE LA VEILLE DU CLIENT (optionnel) :\n${veille
      .map((v, i) => `${i + 1}. ${v.title}${v.excerpt ? ` — ${v.excerpt.slice(0, 150)}` : ""}${v.link ? ` [${v.link}]` : ""}`)
      .join("\n")}
Si l'UNE de ces actualités est réellement pertinente pour ce post, appuie-toi dessus :
rebondis en expert (analyse, prise de position, conséquence concrète pour la cible) et
cite la source. Sinon, ignore-les complètement — ne force jamais le lien.`;
    format = `{"text": "le post complet", "inspiration_url": "URL exacte de l'actualité utilisée, ou null"}`;
  }

  return `Rédige un post LinkedIn.
- Auteur : ${user.expertise}
- Thématique : ${theme}
- Ton : ${user.tone || "Professionnel"}
- Longueur maximale STRICTE : ${user.defaultMaxChars || 1300} caractères${ctx}${campaignBlock}${veilleBlock}

Format de réponse JSON :
${format}`;
}

export async function generateText(user, theme, campaignContext, veille) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(user, theme, campaignContext, veille) }],
    }),
  });
  if (!res.ok) throw new Error("API Claude indisponible (" + res.status + ")");
  const data = await res.json();
  logUsage(user.id, {
    context: "campagne",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  });
  const raw = data.content?.[0]?.text ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse IA non parsable");
  const parsed = JSON.parse(match[0]);
  return {
    text: parsed.text,
    inspirationUrl:
      parsed.inspiration_url && parsed.inspiration_url !== "null" ? parsed.inspiration_url : null,
  };
}

// Planifie des créations : un post généré par créneau libre de la période.
// Si campaignId est fourni (ou qu'une campagne active existe), le thème et le
// brief de la campagne contextualisent chaque post.
// Renvoie { created, skipped } — skipped = créneaux déjà occupés.
export async function planCampaignForUser(
  userId,
  { periodDays = 7, themes, target = "person", cap = 12, campaignId } = {}
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Utilisateur introuvable.");
  if (!user.publishDays) throw new Error("Définissez d'abord votre rythme de publication (onglet Profil).");
  if (!user.expertise) throw new Error("Complétez votre profil : expertise manquante.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquante.");

  // Campagne : explicite, sinon la plus récente active
  let campaign = null;
  if (campaignId) {
    campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error("Campagne introuvable.");
  } else {
    campaign = await prisma.campaign.findFirst({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + periodDays * 86400000);
  const slots = nextPreferredSlots(user, 100, now).filter((s) => s <= horizon).slice(0, cap);

  // Créneaux déjà occupés (posts planifiés ou en attente sur la période)
  const existing = await prisma.draft.findMany({
    where: {
      userId,
      status: { in: ["programmé", "à valider"] },
      scheduledAt: { gte: now, lte: horizon },
    },
    select: { scheduledAt: true },
  });
  const occupied = new Set(existing.map((d) => d.scheduledAt.getTime()));
  const freeSlots = slots.filter((s) => !occupied.has(s.getTime()));

  const themesList = (themes || (campaign ? "" : user.themes) || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const status = user.requireValidation ? "à valider" : "programmé";
  const created = [];

  // Progression narrative : les posts déjà créés pour cette campagne
  // alimentent la génération des suivants (le post n prolonge le post n-1)
  let previousTexts = [];
  if (campaign) {
    const prev = await prisma.draft.findMany({
      where: { campaignId: campaign.id },
      orderBy: { scheduledAt: "asc" },
      select: { text: true },
    });
    previousTexts = prev.map((p) => p.text);
  }

  // Veille : actualités récentes des sources du client, proposées comme ancrage.
  // Les articles déjà utilisés par d'anciens posts sont exclus, puis chaque
  // article retenu par l'IA est retiré du pool (jamais deux posts sur le même).
  let veillePool = [];
  try {
    const sources = await prisma.contentSource.findMany({ where: { userId } });
    if (sources.length) {
      const items = await getVeille(userId, sources);
      const usedUrls = new Set(
        (
          await prisma.draft.findMany({
            where: { userId, inspirationUrl: { not: null } },
            select: { inspirationUrl: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        ).map((d) => d.inspirationUrl)
      );
      const twoWeeksAgo = Date.now() - 14 * 86400000;
      veillePool = items
        .filter((i) => i.link && !usedUrls.has(i.link) && (!i.date || new Date(i.date) > twoWeeksAgo))
        .slice(0, 12);
    }
  } catch (e) {
    console.error("[campagne] veille indisponible:", e.message); // non bloquant
  }

  for (let i = 0; i < freeSlots.length; i++) {
    let theme;
    let context = campaign?.context ?? "";
    if (campaign) {
      const position = previousTexts.length + 1;
      theme = `${campaign.theme} — post n°${position} de la campagne`;
      if (previousTexts.length === 0) {
        context += `\n\nC'est le PREMIER post de la campagne : pose le sujet, ouvre la réflexion,
donne envie de suivre la suite.`;
      } else {
        const recent = previousTexts.slice(-3);
        context += `\n\nPROGRESSION DE LA CAMPAGNE — voici les posts précédents :\n${recent
          .map((t, j) => `--- Post n°${position - recent.length + j} ---\n${t.slice(0, 600)}`)
          .join("\n")}
\nLe nouveau post (n°${position}) doit PROLONGER cette progression : il s'appuie sur ce qui
précède (référence légère, pas de résumé), approfondit d'un cran, n'utilise JAMAIS un angle
ou une accroche déjà employés, et fait avancer le lecteur vers la conclusion de la campagne.`;
      }
    } else if (themesList.length > 0) {
      theme = themesList[i % themesList.length];
    } else {
      theme = "libre — choisis l'angle le plus pertinent pour la cible et les objectifs";
    }
    const { text, inspirationUrl } = await generateText(user, theme, context, veillePool);
    if (campaign) previousTexts.push(text);
    // L'article utilisé sort du pool pour les posts suivants
    if (inspirationUrl) {
      veillePool = veillePool.filter((v) => v.link !== inspirationUrl);
    }
    const draft = await prisma.draft.create({
      data: {
        userId,
        type: "simple",
        theme: campaign ? `${campaign.name}` : themesList.length > 0 ? theme : "Sujet libre (IA)",
        expertise: user.expertise,
        tone: user.tone || "Professionnel",
        maxChars: user.defaultMaxChars || 1300,
        text,
        status,
        scheduledAt: freeSlots[i],
        target,
        auto: true,
        campaignId: campaign?.id ?? null,
        inspirationUrl,
      },
    });
    created.push(draft);
  }

  return { created: created.length, skipped: slots.length - freeSlots.length, status, campaign: campaign?.name ?? null };
}
