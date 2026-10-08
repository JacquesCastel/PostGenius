import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { logUsage } from "@/lib/usage";
import { checkAccess } from "@/lib/gating";
import { getRemarks, remarksPromptBlock } from "@/lib/remarks";
import { normalizeVideoExtra } from "@/lib/shootingKit";
import { normalizeLanguage, languageInstruction, systemPromptFor } from "@/lib/languages";
import { normalizeMood, moodInstruction } from "@/lib/moods";
import { styleExamplesFor } from "@/lib/styleCorpus";
import { knowledgeFor } from "@/lib/knowledge";
import { usedSources } from "@/lib/knowledgeText";
import { cleanSource, sourceBlock } from "@/lib/generationSource";
import { REFINE_CHAT_JSON, REFINE_CHAT_INSTRUCTION, historyBlock, cleanRefineChat } from "@/lib/refineChat";
import { publishVoiceBlock } from "@/lib/publishVoice";
import { cleanPostContext, postContextBlock } from "@/lib/postContext";
import { writingRulesPrompt, WHY_INSTRUCTION, WHY_JSON_FORMAT, cleanWhy } from "@/lib/linkedinRules";

// Génération du post via l'API Claude (Messages API).
// Le profil de rédaction du client (titre, consignes de style) enrichit le prompt.
// Clé requise : ANTHROPIC_API_KEY dans .env

const SYSTEM_PROMPT = `Tu es un expert en copywriting LinkedIn francophone.
Tu rédiges des posts qui maximisent l'engagement en appliquant strictement les règles
d'écriture LinkedIn fournies dans chaque demande.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans backticks ni texte autour.`;

// Rappel du format JSON attendu pour "extra", selon le type de post — le carrousel a
// besoin de "slides" (structure de mise en page) en plus de "items" (résumé lisible),
// sans quoi le modèle omet parfois le second faute de le voir dans le rappel de format.
function extraFormat(type) {
  if (type === "simple") return "null";
  if (type === "carrousel") return `{"title": "...", "items": ["..."], "slides": [{"type": "title", "title": "...", "subtitle": "..."}, {"type": "content", "title": "...", "body": "..."}, {"type": "end", "cta": "..."}]}`;
  if (type === "video") return `{"title": "Script vidéo", "items": ["0-5s — ..."], "shots": [{"time": "0-5s", "say": "...", "show": "...", "onScreen": "..."}], "tips": ["..."]}`;
  return `{"title": "...", "items": ["..."]}`;
}

function buildUserPrompt({ type, theme, expertise, tone, maxChars, refine, mode, count, variants, inspiration, language, mood, source, voice, postContext }, profile, remarks = [], knowledge = { picked: [], block: "" }, styleBlock = "") {
  // Les sources de la base de connaissances sont numérotées [S1]… ; le modèle indique celles qu'il a utilisées
  const srcFmt = knowledge.picked.length ? ', "sources": [numéros des sources [S…] réellement utilisées dans le post, ou une liste vide]' : "";
  let extraSpec = "";
  if (type === "carrousel") {
    extraSpec = `\nC'est un post carrousel : fournis aussi dans "extra" un plan de 8 slides, sous DEUX formes qui se correspondent dans le même ordre :
- "title": "Plan du carrousel" ;
- "items" : 8 chaînes courtes "Slide N — contenu" (résumé lisible) ;
- "slides" : 8 objets structurés pour la mise en page (jamais de texte au-delà des limites indiquées) :
  - le 1er : {"type": "title", "title": "titre accrocheur du carrousel (80 caractères max)", "subtitle": "sous-titre optionnel (120 caractères max) ou null"} ;
  - les 6 suivants : {"type": "content", "title": "titre court de la slide (60 caractères max)", "body": "développement, 2-3 phrases courtes (320 caractères max)"} ;
  - le dernier : {"type": "end", "cta": "appel à l'action final, ex : « Suivez-moi pour plus de conseils »"}.
Le texte du post doit teaser le carrousel.`;
  } else if (type === "video") {
    extraSpec = `\nC'est un post vidéo que l'auteur va filmer lui-même : fournis aussi un kit de tournage de 60-90 secondes dans "extra", sous DEUX formes qui se correspondent dans le même ordre :
- "title": "Script vidéo" ;
- "items" : une chaîne par plan avec timecodes, "0-5s — ce qui est dit" (résumé lisible) ;
- "shots" : 6 à 10 plans, chacun {"time": "0-5s", "say": "les phrases EXACTES à dire face caméra, naturelles à l'oral, courtes (400 caractères max)", "show": "ce qu'on voit à l'image : cadrage, geste, décor, illustration (150 caractères max)", "onScreen": "texte court à incruster à l'écran (60 caractères max) ou null"} ;
- "tips" : 3 à 4 conseils de tournage concrets et adaptés à ce sujet (lumière, cadrage, rythme, sous-titres).
Le 1er plan est une accroche qui retient dans les 3 premières secondes, le dernier un appel à l'action. Le texte du post doit accompagner la vidéo sans la répéter.`;
  }
  let profileSpec = "";
  if (profile?.headline) profileSpec += `\n- Titre professionnel de l'auteur : ${profile.headline}`;
  if (profile?.companyName) profileSpec += `\n- Entreprise / marque : ${profile.companyName}`;
  if (profile?.businessDescription)
    profileSpec += `\n- Activité et proposition de valeur : ${profile.businessDescription}`;
  if (profile?.targetAudience) profileSpec += `\n- Audience cible sur LinkedIn : ${profile.targetAudience}`;
  if (profile?.market) profileSpec += `\n- Marché et positionnement : ${profile.market}`;
  if (profile?.commGoals)
    profileSpec += `\n- Objectifs de communication : ${profile.commGoals} (oriente le post vers ces objectifs)`;
  if (profile?.styleNotes)
    profileSpec += `\n- Consignes de style de l'auteur (À RESPECTER IMPÉRATIVEMENT) : ${profile.styleNotes}`;
  profileSpec += styleBlock;
  profileSpec += knowledge.block;
  profileSpec += remarksPromptBlock(remarks);
  profileSpec += languageInstruction(language);
  profileSpec += moodInstruction(normalizeMood(mood));
  // Où le post sera publié : profil perso ou page entreprise (la voix change)
  if (voice) profileSpec += publishVoiceBlock(voice.kind, voice.pageName, voice.brandVoice);
  // Public, objectif et angle propres à ce post
  profileSpec += postContextBlock(postContext);

  // Mode retouche : réécriture d'un post existant selon une consigne
  if (refine?.text && refine?.instruction) {
    return `Voici un post LinkedIn existant :
"""
${refine.text}
"""

Réécris-le en appliquant cette consigne : ${refine.instruction}${historyBlock(refine.history)}
Contraintes inchangées :
- Auteur : ${expertise}
- Thématique : ${theme}
- Ton : ${tone}
- Longueur maximale STRICTE : ${maxChars} caractères${profileSpec}${extraSpec}

${writingRulesPrompt(maxChars)}
(Ces règles s'appliquent sauf si la consigne ci-dessus demande explicitement le contraire.)

${WHY_INSTRUCTION}

${REFINE_CHAT_INSTRUCTION}

Format de réponse JSON :
{"text": "le post complet", "extra": ${extraFormat(type)}, ${WHY_JSON_FORMAT}, ${REFINE_CHAT_JSON}${srcFmt}}`;
  }

  // Mode série : N posts gradués sur un thème, avec reveal final
  if (mode === "series") {
    const n = Math.min(10, Math.max(2, Number(count) || 5));
    return `Crée une SÉRIE de ${n} posts LinkedIn sur la thématique : ${theme}

Principe de la série — montée en tension graduée :
- Post 1 : teaser intrigant, on annonce qu'une révélation arrive, sans rien dévoiler
- Posts intermédiaires : indices, valeur croissante, la curiosité monte à chaque post
- Post ${n} (dernier) : le REVEAL — la révélation complète, le message clé de la série
Chaque post doit fonctionner seul ET donner envie de suivre la suite (rappeler la série,
annoncer le prochain épisode).

Contraintes :
- Auteur : ${expertise}
- Ton : ${tone}
- Longueur maximale STRICTE par post : ${maxChars} caractères${profileSpec}

${writingRulesPrompt(maxChars)}
(Règles à appliquer à chaque post de la série.)

Format de réponse JSON (exactement ${n} posts) :
{"posts": [{"title": "Post 1 — Teaser", "text": "..."}, ..., {"title": "Post ${n} — Reveal", "text": "..."}]}`;
  }

  // Article de veille servant d'inspiration
  let inspirationSpec = "";
  if (inspiration?.title) {
    inspirationSpec = `\n\nSOURCE D'INSPIRATION — actualité repérée dans la veille du client :
- Titre : ${inspiration.title}${inspiration.excerpt ? `\n- Extrait : ${inspiration.excerpt}` : ""}${
      inspiration.url ? `\n- URL : ${inspiration.url}` : ""
    }
Le post doit REBONDIR sur cette actualité avec le point de vue d'expert de l'auteur
(analyse, prise de position, conséquences concrètes pour sa cible) — pas un simple résumé.
Citer la source si pertinent.`;
  }

  const base = `Rédige un post LinkedIn.
- Auteur : ${expertise}
- Thématique : ${theme}
- Ton : ${tone}
- Longueur maximale STRICTE : ${maxChars} caractères${profileSpec}${inspirationSpec}${sourceBlock(source)}${extraSpec}

${writingRulesPrompt(maxChars)}`;

  // Variantes : plusieurs propositions d'angles différents
  if (variants && Number(variants) > 1) {
    const n = Math.min(5, Number(variants));
    return `${base}

Propose ${n} VARIANTES distinctes du post : angles d'attaque différents
(ex : anecdote, chiffre choc, question provocante), même thématique et mêmes contraintes.

${WHY_INSTRUCTION}

Format de réponse JSON (exactement ${n} variantes) :
{"variants": [{"text": "...", "extra": ${extraFormat(type)}, ${WHY_JSON_FORMAT}${srcFmt}}, ...]}`;
  }

  return `${base}

${WHY_INSTRUCTION}

Format de réponse JSON :
{"text": "le post complet", "extra": ${extraFormat(type)}, ${WHY_JSON_FORMAT}${srcFmt}}`;
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY manquante. Copiez .env.example vers .env et renseignez votre clé." },
      { status: 500 }
    );
  }

  const params = await req.json();
  const { expertise } = params;
  // Post libre : la matière d'un article ou d'un document peut remplacer la thématique (son titre sert de sujet)
  const source = params.mode === "series" || params.refine?.text ? null : cleanSource(params.source);
  const theme = (typeof params.theme === "string" ? params.theme.trim() : "").slice(0, 1500) || source?.title || "";
  if (!theme || !expertise?.trim()) {
    return NextResponse.json({ error: "Thématique et expertise requises." }, { status: 400 });
  }

  // Profil de rédaction du client (consignes de style, titre pro)
  let profile = null;
  const userId = await getUserId(req);
  if (userId) {
    const access = await checkAccess(userId);
    if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  }
  if (userId) {
    profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        headline: true,
        styleNotes: true,
        companyName: true,
        brandVoice: true,
        businessDescription: true,
        targetAudience: true,
        market: true,
        commGoals: true,
        postLanguage: true,
        styleExamples: true,
      },
    });
  }

  // Où le post sera publié (facultatif) : "person" ou "org" + nom de la page
  const voice = params.publishAs?.kind === "org" || params.publishAs?.kind === "person"
    ? { kind: params.publishAs.kind, pageName: typeof params.publishAs.pageName === "string" ? params.publishAs.pageName : "", brandVoice: profile?.brandVoice ?? "" }
    : null;
  // Public / objectif / angle de ce post : seuls les écarts avec le profil comptent
  const postContext = cleanPostContext(params.postContext, profile);
  const remarks = userId ? await getRemarks(userId) : [];
  // Base de connaissances : sources les plus proches du sujet (jamais bloquant)
  const topic = [theme, source?.title, params.inspiration?.title, params.refine?.text?.slice(0, 400)].filter(Boolean).join(" ");
  const knowledge = await knowledgeFor(userId, topic);
  // Exemples de voix : les posts de l'auteur les plus proches du sujet (corpus), sinon ses posts types
  const styleBlock = await styleExamplesFor(userId, topic, profile?.styleExamples);
  // Langue du post : celle choisie dans le formulaire, sinon celle du profil, sinon le français
  const language = normalizeLanguage(params.language ?? profile?.postLanguage);

  try {
    // Le modèle renvoie parfois un JSON invalide (guillemet non échappé dans le texte) :
    // on retente une fois avant d'abandonner.
    let result;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
          // Carrousel : le plan structuré ("slides", en plus de "items") alourdit nettement
          // la réponse JSON — 2048 suffisait avant, mais peut la couper avant la fin
          // maintenant, ce qui fait disparaître "slides" en silence (JSON invalide, ou le
          // modèle raccourcit pour tenir dans le budget).
          max_tokens: params.mode === "series" || params.variants || params.type === "carrousel" || params.type === "video" ? 8000 : 2048,
          system: systemPromptFor(SYSTEM_PROMPT, language),
          messages: [{ role: "user", content: buildUserPrompt({ ...params, theme, source, language, voice, postContext }, profile, remarks, knowledge, styleBlock) }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Erreur API Anthropic:", err);
        return NextResponse.json({ error: "Erreur de l'API Claude. Vérifiez votre clé et vos crédits." }, { status: 502 });
      }

      const data = await res.json();
      logUsage(userId, {
        context:
          params.mode === "series"
            ? "série"
            : params.refine
            ? "retouche"
            : params.variants
            ? "variantes"
            : "post",
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      });
      const raw = data.content?.[0]?.text ?? "";

      try {
        // Extraction robuste du JSON (au cas où le modèle ajoute du texte autour)
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Réponse non parsable: " + raw.slice(0, 200));
        result = JSON.parse(match[0]);
        break;
      } catch (parseError) {
        if (attempt === 2) throw parseError;
        console.warn("Génération : JSON invalide, nouvel essai —", parseError.message);
      }
    }

    // Série de posts
    if (params.mode === "series") {
      if (!Array.isArray(result.posts) || result.posts.length === 0)
        throw new Error("Série invalide");
      return NextResponse.json({ posts: result.posts });
    }
    // Variantes
    if (params.variants && Array.isArray(result.variants) && result.variants.length > 0) {
      return NextResponse.json({
        variants: result.variants.map((v) => ({ text: v.text, extra: params.type === "video" ? normalizeVideoExtra(v.extra) : v.extra ?? null, why: cleanWhy(v.why, v.text), sources: usedSources(v.sources, knowledge.picked) })),
      });
    }

    const chat = params.refine?.text ? cleanRefineChat(result, remarks) : null;
    return NextResponse.json({ text: result.text, extra: params.type === "video" ? normalizeVideoExtra(result.extra) : result.extra ?? null, why: cleanWhy(result.why, result.text), sources: usedSources(result.sources, knowledge.picked), ...(chat ? { reply: chat.reply, remember: chat.remember } : {}) });
  } catch (e) {
    console.error("Erreur génération:", e);
    return NextResponse.json({ error: "Échec de la génération. Réessayez." }, { status: 500 });
  }
}
