import { prisma } from "../db";
import { logUsage } from "../usage";
import { userContextBlock } from "../campaign";
import { getPillars, findOrCreatePillar } from "./pillars";
import { getEditorialHistory, historyDigest, topicSimilarityScore } from "./history";

// Moteur de recommandations éditoriales — "Que publier ?"
// Ne réécrit PAS de posts : produit des pistes (sujet, angle, justification)
// que l'utilisateur envoie ensuite au moteur de génération existant
// (app/api/generate) via le bouton "Générer ce post".

const SYSTEM_PROMPT = `Tu es un stratège éditorial LinkedIn francophone.
Ton rôle n'est PAS d'écrire des posts, mais de proposer des PISTES de contenu
pertinentes, argumentées et non répétitives, en t'appuyant sur le profil et
l'historique de publication du client.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans backticks ni texte autour.`;

const FRESH_HOURS = 20; // ne régénère pas si des recos "proposée" récentes existent déjà

function buildPrompt({ user, pillars, digest, count }) {
  const profile = userContextBlock(user) || "\n(profil peu renseigné — reste générique mais utile)";
  const pillarNames = pillars.map((p) => p.name).join(", ");

  return `Voici le profil du client :${profile}

Piliers éditoriaux disponibles : ${pillarNames}
(tu peux en proposer un nouveau si aucun ne convient, mais préfère réutiliser ceux-ci)

Historique récent de publication :
${digest.recentPostsBlock}

Répartition par pilier sur cet historique : ${digest.pillarBalanceBlock}
${digest.daysSinceLastPost != null ? `Dernière publication il y a ${digest.daysSinceLastPost} jour(s).` : "Aucune publication connue encore."}

Propose ${count} recommandations de contenu DISTINCTES pour le prochain post LinkedIn.
Règles impératives :
- Ne propose JAMAIS un sujet ou un angle déjà traité récemment (voir historique) — reformuler ne suffit pas, change vraiment d'angle.
- Cherche à RÉÉQUILIBRER les piliers : si un pilier domine l'historique, ne le reproduis pas ; mets en avant les piliers peu utilisés ou absents.
- Chaque recommandation doit avoir une justification COURTE (1-2 phrases, tutoiement interdit, vouvoiement) qui explique CONCRÈTEMENT pourquoi ce sujet est pertinent MAINTENANT pour CE client (référence à son historique, son secteur ou son objectif — jamais une phrase générique).
- Varie les types de post (simple, carrousel, video) et les piliers entre les ${count} propositions.
- "priority" (0-100) = à quel point cette reco devrait passer avant les autres. "confidence" (0-100) = ta confiance dans la pertinence.

Réponds en JSON :
{"recommendations": [
  {
    "topic": "sujet précis",
    "angle": "angle éditorial en une phrase",
    "rationale": "pourquoi maintenant, pour ce client, en 1-2 phrases",
    "objective": "notoriété | leads | expertise | recrutement | ...",
    "pillar": "nom d'un pilier de la liste, ou un nouveau nom court",
    "audience": "audience visée ou null",
    "postType": "simple | carrousel | video",
    "hook": "accroche suggérée (1re ligne)",
    "cta": "appel à l'action suggéré ou null",
    "priority": 0-100,
    "confidence": 0-100
  }
]}`;
}

async function callClaude(prompt) {
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
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("API Claude indisponible (" + res.status + ")");
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse IA non parsable");
  return { parsed: JSON.parse(match[0]), usage: data.usage };
}

// Recommandations actives (non traitées) déjà en base, sans appeler l'IA.
export async function getActiveRecommendations(userId) {
  return prisma.editorialRecommendation.findMany({
    where: { userId, status: "proposée" },
    include: { pillar: { select: { id: true, name: true } } },
    orderBy: { priority: "desc" },
  });
}

// Génère (ou réutilise) les recommandations éditoriales d'un utilisateur.
// force=true ignore le cache et régénère même si des recos fraîches existent.
export async function generateRecommendations(userId, { count = 3, force = false } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquante.");

  if (!force) {
    const fresh = await prisma.editorialRecommendation.findFirst({
      where: { userId, status: "proposée", createdAt: { gte: new Date(Date.now() - FRESH_HOURS * 3600000) } },
    });
    if (fresh) return getActiveRecommendations(userId);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Utilisateur introuvable.");

  const pillars = await getPillars(userId);
  const history = await getEditorialHistory(userId);
  const digest = historyDigest(history, pillars);

  const { parsed, usage } = await callClaude(buildPrompt({ user, pillars, digest, count }));
  logUsage(userId, {
    context: "recommandation éditoriale",
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  });

  const items = Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, count) : [];
  if (!items.length) throw new Error("Aucune recommandation générée.");

  // Écarte les propositions trop proches de l'historique récent (filet de
  // sécurité en plus de la consigne donnée à l'IA) plutôt que de les rejeter :
  // on baisse leur priorité pour qu'elles passent après les autres.
  const scored = items.map((it) => {
    const sim = topicSimilarityScore(it.topic, history.drafts);
    const priority = Math.round((Number(it.priority) || 50) * (sim > 0.35 ? 0.5 : 1));
    return { ...it, priority };
  });

  // Les anciennes recos "proposée" non traitées sont remplacées par la nouvelle
  // fournée (on garde leur trace via le statut plutôt que de les supprimer).
  if (force) {
    await prisma.editorialRecommendation.updateMany({
      where: { userId, status: "proposée" },
      data: { status: "ignorée", respondedAt: new Date() },
    });
  }

  const created = [];
  for (const it of scored) {
    const pillar = it.pillar ? await findOrCreatePillar(userId, it.pillar) : null;
    const reco = await prisma.editorialRecommendation.create({
      data: {
        userId,
        topic: String(it.topic || "").slice(0, 300),
        angle: String(it.angle || "").slice(0, 500),
        rationale: String(it.rationale || "").slice(0, 500),
        objective: it.objective ? String(it.objective).slice(0, 120) : null,
        audience: it.audience ? String(it.audience).slice(0, 200) : null,
        postType: ["simple", "carrousel", "video"].includes(it.postType) ? it.postType : "simple",
        hook: it.hook ? String(it.hook).slice(0, 300) : null,
        cta: it.cta ? String(it.cta).slice(0, 200) : null,
        priority: Math.min(100, Math.max(0, Math.round(Number(it.priority) || 50))),
        confidence: Math.min(100, Math.max(0, Math.round(Number(it.confidence) || 50))),
        pillarId: pillar?.id ?? null,
      },
      include: { pillar: { select: { id: true, name: true } } },
    });
    created.push(reco);
  }

  return created.sort((a, b) => b.priority - a.priority);
}

// Marque une recommandation comme traitée (générée/planifiée/ignorée/rejetée).
// draftId : renseigné quand le post a effectivement été généré, pour tracer
// le lien recommandation → brouillon (feedback implicite : reco "acceptée").
export async function respondToRecommendation(userId, id, { status, draftId } = {}) {
  const allowed = ["générée", "planifiée", "ignorée", "rejetée"];
  if (!allowed.includes(status)) throw new Error("Statut invalide.");
  const reco = await prisma.editorialRecommendation.findFirst({ where: { id, userId } });
  if (!reco) throw new Error("Recommandation introuvable.");
  return prisma.editorialRecommendation.update({
    where: { id },
    data: { status, respondedAt: new Date(), ...(draftId ? { draftId } : {}) },
  });
}
