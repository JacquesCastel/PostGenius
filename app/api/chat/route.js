import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Assistant public : répond aux questions sur LinkeePost (process, offres, aide).
// Modèle économique par défaut (Haiku), configurable via ANTHROPIC_CHAT_MODEL.

const SYSTEM = `Tu es l'assistant de LinkeePost, un SaaS français qui aide à gérer sa présence LinkedIn.
Réponds en français, de façon chaleureuse, claire et CONCISE (2 à 5 phrases). Tu peux utiliser des listes courtes.

Ce qu'est LinkeePost :
- Un outil qui transforme l'expertise de l'utilisateur en posts et campagnes LinkedIn générés par IA, programmés et publiés en pilote automatique.

Fonctionnalités :
- Profil de rédaction : l'utilisateur décrit une fois son activité, sa cible, son ton et son rythme ; l'IA écrit ensuite à son image.
- Génération de posts simples, carrousels (plan de slides) et scripts vidéo ; retouche et variantes possibles.
- Campagnes guidées par l'IA : un thème, 3 questions de cadrage, un post d'exemple à valider, puis une série planifiée.
- Veille connectée : surveille des sources/flux RSS du secteur et propose des inspirations.
- Images générées par IA, cohérentes avec le post.
- Programmation et pilote automatique : publication aux créneaux choisis, avec validation optionnelle.
- Publication via l'API officielle LinkedIn (OAuth) sur le profil personnel et, selon l'offre, les pages entreprise.
- Statistiques : impressions, vues, taux d'engagement, progression des campagnes.

Comment démarrer : créer un compte sur la page d'inscription (bouton « Essai gratuit »). 14 jours d'essai gratuit, sans carte bancaire.

Offres (par mois, HT) :
- Essentiel — 29 € : 15 posts/mois, profil de rédaction, programmation, publication sur le profil personnel. Pas d'images IA, ni de campagnes, ni de veille.
- Pro — 59 € : posts illimités, campagnes guidées par l'IA, veille connectée, 50 images IA/mois, validation avant publication, statistiques détaillées.
- Agence — 149 € : tout Pro, images illimitées, publication sur pages entreprise, statistiques de page, support prioritaire.

Règles :
- Ne promets aucune fonctionnalité qui n'est pas listée ci-dessus.
- Si on te demande un prix ou une limite précise, donne celle de l'offre concernée.
- Si la question sort du sujet LinkeePost/LinkedIn, recadre gentiment.
- Quand c'est pertinent, invite à essayer gratuitement (bouton « Essai gratuit ») ou à utiliser le formulaire de contact.
- Tu ne peux pas accéder au compte de l'utilisateur ni effectuer d'action ; tu informes et tu orientes.`;

export async function POST(req) {
  if (!rateLimit(`chat:${clientIp(req)}`, { limit: 20, windowMs: 600_000 })) {
    return NextResponse.json({ error: "Trop de messages. Réessayez dans quelques minutes." }, { status: 429 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Assistant indisponible pour le moment." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const safe = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (safe.length === 0 || safe[safe.length - 1].role !== "user") {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  try {
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
        system: SYSTEM,
        messages: safe,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: "L'assistant n'a pas pu répondre." }, { status: 502 });
    }
    const reply = data?.content?.[0]?.text?.trim() || "Désolé, je n'ai pas de réponse pour le moment.";
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Erreur de l'assistant." }, { status: 502 });
  }
}
