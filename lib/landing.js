// Contenu éditable de la landing. Valeurs par défaut = contenu actuel codé.
// getLanding() lit l'override en base (SiteContent key="landing") et le fusionne
// sur les défauts. Tout échec → défauts (la landing ne casse jamais).

import { prisma } from "./db";

export const LANDING_DEFAULTS = {
  hero: {
    badge: "14 jours d'essai gratuit — sans carte bancaire",
    title: "Vos campagnes LinkedIn en",
    titleAccent: "pilote automatique",
    subtitle:
      "PostGenius transforme votre expertise en posts qui vous ressemblent : campagnes guidées par l'IA, veille de votre secteur, publication programmée à votre rythme — vous ne faites plus que valider.",
  },
  plans: [
    {
      name: "Essentiel",
      price: "29",
      desc: "Pour publier régulièrement sans y passer ses soirées.",
      features: [
        "Posts et séries générés par l'IA",
        "Profil de rédaction (style, contexte métier)",
        "Programmation sur votre rythme",
        "15 posts par mois",
        "Publication sur votre profil LinkedIn",
      ],
      cta: "Commencer l'essai",
      highlight: false,
    },
    {
      name: "Pro",
      price: "59",
      desc: "L'outil de campagne complet pour les indépendants et consultants.",
      features: [
        "Tout Essentiel, posts illimités*",
        "Campagnes avec brief IA et progression",
        "Veille connectée et inspirations",
        "Images générées par IA (50/mois)",
        "Validation avant publication",
        "Statistiques détaillées",
      ],
      cta: "Commencer l'essai",
      highlight: true,
    },
    {
      name: "Agence",
      price: "149",
      desc: "Pour les équipes marketing et les pages entreprise.",
      features: [
        "Tout Pro, images illimitées*",
        "Publication sur page entreprise",
        "Statistiques de page (impressions, engagement)",
        "Multi-utilisateurs (bientôt)",
        "Support prioritaire",
      ],
      cta: "Commencer l'essai",
      highlight: false,
    },
  ],
  faq: [
    {
      q: "Comment PostGenius se connecte-t-il à LinkedIn ?",
      a: "Via l'API officielle de LinkedIn (OAuth) : vous autorisez l'application, aucun mot de passe LinkedIn ne nous est confié, et vous pouvez révoquer l'accès à tout moment.",
    },
    {
      q: "Qui écrit réellement les posts ?",
      a: "L'IA rédige à partir de votre contexte : activité, cible, marché, objectifs et consignes de style. Vous restez maître du contenu — chaque post peut être retouché, validé ou refusé avant publication.",
    },
    {
      q: "Mes posts seront-ils publiés sans mon accord ?",
      a: "C'est vous qui décidez : activez la validation et chaque post planifié attend votre feu vert. Ou laissez le pilote automatique gérer de bout en bout.",
    },
    {
      q: "Que se passe-t-il après les 14 jours d'essai ?",
      a: "Vous choisissez un plan pour continuer. Aucune carte bancaire n'est demandée pendant l'essai, rien n'est prélevé sans action de votre part.",
    },
    {
      q: "Puis-je résilier à tout moment ?",
      a: "Oui, l'abonnement est sans engagement : la résiliation prend effet à la fin de la période en cours.",
    },
  ],
};

export async function getLanding() {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: "landing" } });
    if (!row?.value) return LANDING_DEFAULTS;
    const saved = JSON.parse(row.value);
    return {
      hero: { ...LANDING_DEFAULTS.hero, ...(saved.hero || {}) },
      plans: Array.isArray(saved.plans) && saved.plans.length ? saved.plans : LANDING_DEFAULTS.plans,
      faq: Array.isArray(saved.faq) && saved.faq.length ? saved.faq : LANDING_DEFAULTS.faq,
    };
  } catch {
    return LANDING_DEFAULTS;
  }
}
