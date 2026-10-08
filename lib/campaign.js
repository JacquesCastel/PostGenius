import { prisma } from "./db";
import { getVeille } from "./veille";
import { logUsage } from "./usage";
import { writingRulesPrompt } from "./linkedinRules";
import { getRemarks, remarksPromptBlock } from "./remarks";
import { languageInstruction, systemPromptFor } from "./languages";
import { moodInstruction, normalizeMood } from "./moods";
import { styleExamplesFor } from "./styleCorpus";
import { knowledgeFor } from "./knowledge";
import { publishVoiceBlock, parsePublishAs } from "./publishVoice";
import { overlayProfile } from "./contextOverlay";
import { REFINE_CHAT_JSON, REFINE_CHAT_INSTRUCTION, historyBlock, cleanRefineChat } from "./refineChat";

// Moteur de campagne : génère des posts via Claude et les planifie sur les
// créneaux du rythme de publication de l'utilisateur.
// Utilisé par /api/campaign/plan (action manuelle) et par le pilote
// automatique du scheduler.

const SYSTEM_PROMPT = `Tu es un expert en copywriting LinkedIn francophone.
Tu rédiges des posts qui maximisent l'engagement en appliquant strictement les règles
d'écriture LinkedIn fournies dans chaque demande.
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
  if (user.editorialLine) ctx += `\n- Ligne éditoriale de l'entreprise (À RESPECTER : angle, registre, sujets à privilégier ou éviter) : ${user.editorialLine}`;
  if (user.styleNotes) ctx += `\n- Consignes de style (À RESPECTER IMPÉRATIVEMENT) : ${user.styleNotes}`;
  if (user.editorialNote) ctx += `\n- Note du client pour affiner les propositions actuelles : ${user.editorialNote}`;
  return ctx;
}

// chat : { history } quand le client ajuste l'exemple en conversation (le modèle répond en une phrase et peut proposer des « À retenir »)
function buildPrompt(user, theme, campaignContext = "", veille = null, remarks = [], mood = null, knowledge = "", styleBlock = "", chat = null, voice = null) {
  const ctx = userContextBlock(user) + knowledge + styleBlock + remarksPromptBlock(remarks) + languageInstruction(user.postLanguage) + moodInstruction(normalizeMood(mood)) + (voice ? publishVoiceBlock(voice.kind, voice.pageName, voice.brandVoice) : "");
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
  let chatBlock = "";
  if (chat) {
    chatBlock = `\n\n${REFINE_CHAT_INSTRUCTION}${historyBlock(chat.history)}`;
    format = format.replace(/\}$/, `, ${REFINE_CHAT_JSON}}`);
  }

  return `Rédige un post LinkedIn.
- Auteur : ${user.expertise}
- Thématique : ${theme}
- Ton : ${user.tone || "Professionnel"}
- Longueur maximale STRICTE : ${user.defaultMaxChars || 1300} caractères${ctx}${campaignBlock}${veilleBlock}

${writingRulesPrompt(user.defaultMaxChars || 1300)}${chatBlock}

Format de réponse JSON :
${format}`;
}

// mood : humeur éditoriale (code de lib/moods.js), optionnelle
// voice : { kind: "person" | "org", pageName } — où le post sera publié (facultatif)
export async function generateText(user, theme, campaignContext, veille, mood = null, chat = null, voice = null, contextId = null) {
  const remarks = await getRemarks(user.id);
  // Base de connaissances : sources proches du sujet de la campagne (jamais bloquant)
  const topic = `${theme} ${String(campaignContext ?? "").slice(0, 600)}`;
  const knowledge = (await knowledgeFor(user.id, topic, contextId)).block;
  const styleBlock = await styleExamplesFor(user.id, topic, user.styleExamples);
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
      system: systemPromptFor(SYSTEM_PROMPT, user.postLanguage),
      messages: [{ role: "user", content: buildPrompt(user, theme, campaignContext, veille, remarks, mood, knowledge, styleBlock, chat, voice) }],
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
    ...(chat ? cleanRefineChat(parsed, remarks) : {}),
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

  // Entreprise de la campagne : son contexte remplace celui de l'entreprise principale (la personne, son rythme et sa voix restent les siens)
  const ctxId = campaign?.contextId ?? null;
  const ctxRow = ctxId ? await prisma.context.findFirst({ where: { id: ctxId, userId } }) : null;
  const author = ctxRow ? overlayProfile(user, ctxRow) : user;

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
      // « Profil + page » : deux versions par créneau ; la progression suit la version du profil
      where: { campaignId: campaign.id, ...(parsePublishAs(target).kind === "both" ? { target: "person" } : {}) },
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
    const sources = await prisma.contentSource.findMany({ where: { userId, contextId: ctxRow?.id ?? null } });
    if (sources.length) {
      const items = await getVeille(userId, sources, { scope: ctxRow?.id ?? "" });
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

  // Où publier : profil, page, ou les deux (deux versions adaptées, une par voix)
  const publishAs = parsePublishAs(target);
  let pageName = "";
  if (publishAs.orgUrn) {
    const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgAccounts: true } }).catch(() => null);
    try {
      pageName = JSON.parse(acc?.orgAccounts ?? "[]").find((o) => o.urn === publishAs.orgUrn)?.name ?? "";
    } catch {}
    if (!pageName) pageName = author.companyName ?? "";
  }
  const tracks = publishAs.kind === "both"
    ? [{ target: "person", kind: "person", offsetMin: 0 }, { target: publishAs.orgUrn, kind: "org", offsetMin: 60 }]
    : [{ target: publishAs.orgUrn ?? "person", kind: publishAs.kind, offsetMin: 0 }];

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
    let firstText = null;
    let inspirationUrl = null;
    for (const track of tracks) {
      const gen = await generateText(author, theme, context, veillePool, campaign?.mood, null, { kind: track.kind, pageName, brandVoice: author.brandVoice }, ctxRow?.id ?? null);
      const text = gen.text;
      if (firstText === null) { firstText = text; inspirationUrl = gen.inspirationUrl; }
      const draft = await prisma.draft.create({
        data: {
          userId,
          type: "simple",
          theme: campaign ? `${campaign.name}` : themesList.length > 0 ? theme : "Sujet libre (IA)",
          expertise: user.expertise,
          tone: user.tone || "Professionnel",
          maxChars: user.defaultMaxChars || 1300,
          text,
          generatedText: text,
          status,
          scheduledAt: new Date(freeSlots[i].getTime() + track.offsetMin * 60000),
          target: track.target,
          auto: true,
          campaignId: campaign?.id ?? null,
          contextId: ctxRow?.id ?? null,
          inspirationUrl: gen.inspirationUrl ?? null,
        },
      });
      created.push(draft);
    }
    if (campaign) previousTexts.push(firstText);
    // L'article utilisé sort du pool pour les posts suivants
    if (inspirationUrl) {
      veillePool = veillePool.filter((v) => v.link !== inspirationUrl);
    }
  }

  return { created: created.length, skipped: slots.length - freeSlots.length, status, campaign: campaign?.name ?? null };
}
