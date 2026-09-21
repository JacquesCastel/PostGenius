import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { logUsage } from "@/lib/usage";
import { checkAccess } from "@/lib/gating";
import { getRemarks, remarksPromptBlock } from "@/lib/remarks";
import { writingRulesPrompt, WHY_INSTRUCTION, WHY_JSON_FORMAT, cleanWhy } from "@/lib/linkedinRules";

// Génération du post via l'API Claude (Messages API).
// Le profil de rédaction du client (titre, consignes de style) enrichit le prompt.
// Clé requise : ANTHROPIC_API_KEY dans .env

const SYSTEM_PROMPT = `Tu es un expert en copywriting LinkedIn francophone.
Tu rédiges des posts qui maximisent l'engagement en appliquant strictement les règles
d'écriture LinkedIn fournies dans chaque demande.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans backticks ni texte autour.`;

function buildUserPrompt({ type, theme, expertise, tone, maxChars, refine, mode, count, variants, inspiration }, profile, remarks = []) {
  let extraSpec = "";
  if (type === "carrousel") {
    extraSpec = `\nC'est un post carrousel : fournis aussi un plan de 8 slides dans "extra"
(titre: "Plan du carrousel", items: tableau de 8 chaînes "Slide N — contenu").
Le texte du post doit teaser le carrousel.`;
  } else if (type === "video") {
    extraSpec = `\nC'est un post vidéo : fournis aussi un script de 60-90 secondes dans "extra"
(titre: "Script vidéo", items: tableau de chaînes avec timecodes "0-5s — ...").
Le texte du post doit accompagner la vidéo.`;
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
  profileSpec += remarksPromptBlock(remarks);

  // Mode retouche : réécriture d'un post existant selon une consigne
  if (refine?.text && refine?.instruction) {
    return `Voici un post LinkedIn existant :
"""
${refine.text}
"""

Réécris-le en appliquant cette consigne : ${refine.instruction}
Contraintes inchangées :
- Auteur : ${expertise}
- Thématique : ${theme}
- Ton : ${tone}
- Longueur maximale STRICTE : ${maxChars} caractères${profileSpec}${extraSpec}

${writingRulesPrompt(maxChars)}
(Ces règles s'appliquent sauf si la consigne ci-dessus demande explicitement le contraire.)

${WHY_INSTRUCTION}

Format de réponse JSON :
{"text": "le post complet", "extra": ${type === "simple" ? "null" : `{"title": "...", "items": ["..."]}`}, ${WHY_JSON_FORMAT}}`;
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
- Longueur maximale STRICTE : ${maxChars} caractères${profileSpec}${inspirationSpec}${extraSpec}

${writingRulesPrompt(maxChars)}`;

  // Variantes : plusieurs propositions d'angles différents
  if (variants && Number(variants) > 1) {
    const n = Math.min(5, Number(variants));
    return `${base}

Propose ${n} VARIANTES distinctes du post : angles d'attaque différents
(ex : anecdote, chiffre choc, question provocante), même thématique et mêmes contraintes.

${WHY_INSTRUCTION}

Format de réponse JSON (exactement ${n} variantes) :
{"variants": [{"text": "...", "extra": ${type === "simple" ? "null" : `{"title": "...", "items": ["..."]}`}, ${WHY_JSON_FORMAT}}, ...]}`;
  }

  return `${base}

${WHY_INSTRUCTION}

Format de réponse JSON :
{"text": "le post complet", "extra": ${type === "simple" ? "null" : `{"title": "...", "items": ["..."]}`}, ${WHY_JSON_FORMAT}}`;
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
  const { theme, expertise } = params;
  if (!theme?.trim() || !expertise?.trim()) {
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
        businessDescription: true,
        targetAudience: true,
        market: true,
        commGoals: true,
      },
    });
  }

  const remarks = userId ? await getRemarks(userId) : [];

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
          max_tokens: params.mode === "series" || params.variants ? 8000 : 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(params, profile, remarks) }],
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
        variants: result.variants.map((v) => ({ text: v.text, extra: v.extra ?? null, why: cleanWhy(v.why, v.text) })),
      });
    }

    return NextResponse.json({ text: result.text, extra: result.extra ?? null, why: cleanWhy(result.why, result.text) });
  } catch (e) {
    console.error("Erreur génération:", e);
    return NextResponse.json({ error: "Échec de la génération. Réessayez." }, { status: 500 });
  }
}
