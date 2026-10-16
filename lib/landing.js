// Contenu éditable de la landing. Valeurs par défaut = contenu actuel codé.
// getLanding() lit l'override en base (SiteContent key="landing") et le fusionne
// sur les défauts. Tout échec → défauts (la landing ne casse jamais).

import { prisma } from "./db";
import { memo, MEMO_TTL } from "./memoCache";

export const LANDING_DEFAULTS = {
  hero: {
    badge: "14 jours d'essai gratuit — sans carte bancaire",
    title: "Des posts LinkedIn qui sonnent comme vous,",
    titleAccent: "parce qu'ils partent de ce que vous savez",
    subtitle:
      "Déposez vos documents, vos liens et vos anciens posts. LinkeePost en tire des faits, votre vocabulaire et votre voix, puis rédige, programme et publie. Vous relisez, vous validez.",
  },
  plans: [
    {
      name: "Essentiel",
      price: "29",
      desc: "Pour publier régulièrement sans y passer ses soirées.",
      features: [
        "Posts et séries générés par l'IA",
        "Profil de rédaction et base de connaissances (5 sources)",
        "Programmation sur votre rythme",
        "9 langues et humeur éditoriale",
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
        "Base de connaissances : 30 sources, éléments de langage, mémoire éditoriale",
        "Contrôle de forme et réécriture ciblée des posts",
        "Campagnes avec brief IA et progression",
        "Veille connectée et inspirations",
        "Images générées par IA (50/mois)",
        "Vidéo : kit de tournage, téléprompteur, import",
        "Interactions LinkedIn (commenter, réagir)",
        "Validation avant publication",
        "Statistiques détaillées",
      ],
      cta: "Commencer l'essai",
      highlight: true,
    },
    {
      name: "Agence",
      price: "149",
      desc: "Pour les agences : les pages entreprise de vos clients, gérées par toute votre équipe.",
      features: [
        "Tout Pro, images illimitées*",
        "Clients illimités : une entreprise et sa page par client",
        "Une mémoire par client : 100 sources chacun, sans mélange entre clients",
        "Jusqu'à 5 utilisateurs (au-delà, nous contacter)",
        "Publication sur page entreprise",
        "Statistiques de page (impressions, engagement)",
        "Module Événements : posts, création sur LinkedIn, notifications jour-J",
        "Support prioritaire",
      ],
      cta: "Commencer l'essai",
      highlight: false,
    },
  ],
  faq: [
    {
      q: "Comment LinkeePost se connecte-t-il à LinkedIn ?",
      a: "Via l'API officielle de LinkedIn (OAuth) : vous autorisez l'application, aucun mot de passe LinkedIn ne nous est confié, et vous pouvez révoquer l'accès à tout moment.",
    },
    {
      q: "Qui écrit réellement les posts ?",
      a: "L'IA rédige à partir de votre contexte (activité, cible, objectifs, consignes de style) et de ce que vous avez déposé : documents, liens, anciens posts, vocabulaire. Vous restez maître du contenu : chaque post peut être retouché, validé ou refusé avant publication.",
    },
    {
      q: "Que devient ce que je dépose ?",
      a: "Vos documents et vos liens servent à rédiger vos posts : leur contenu est transmis au modèle d'IA uniquement pour cela. Vous pouvez les supprimer à tout moment, et la page de confidentialité détaille les traitements.",
    },
    {
      q: "Le texte est-il inventé ?",
      a: "LinkeePost est conçu pour reprendre les faits de vos sources et ne pas inventer de chiffre ni de client. Aucune IA n'est infaillible : relisez chaque post, c'est pourquoi la validation avant publication existe.",
    },
    {
      q: "Le contrôle de forme prédit-il mes résultats ?",
      a: "Non. Il vérifie la mise en forme (accroche, longueur, aération, appel à l'action) avec une grille de règles fixes, et l'IA propose des conseils de fond. C'est un indicateur de qualité de forme, pas une prévision de vues ou de réactions.",
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
      q: "Dans quelles langues puis-je publier ?",
      a: "Français, anglais, espagnol, allemand, italien, portugais, néerlandais, arabe et polonais. Vous choisissez la langue dans votre profil, ou post par post au moment de la création.",
    },
    {
      q: "Puis-je publier des vidéos ?",
      a: "Oui. LinkeePost prépare un kit de tournage (plan par plan, conseils, téléprompteur) ; vous filmez, importez votre vidéo (jusqu'à 200 Mo) et elle est publiée directement sur LinkedIn avec votre texte.",
    },
    {
      q: "Puis-je donner une humeur à mes posts ?",
      a: "Oui : joie, coup de gueule, stress, fierté, doute, humour… L'humeur oriente l'angle, le rythme et le vocabulaire du post, et peut être changée après la génération. Vous pouvez aussi en fixer une pour toute une campagne.",
    },
    {
      q: "Puis-je résilier à tout moment ?",
      a: "Oui, l'abonnement est sans engagement : la résiliation prend effet à la fin de la période en cours.",
    },
  ],
};

export async function getLanding() {
  return memo("landing", MEMO_TTL, async () => {
    const row = await prisma.siteContent.findUnique({ where: { key: "landing" } });
    if (!row?.value) return LANDING_DEFAULTS;
    let saved;
    try {
      saved = JSON.parse(row.value);
    } catch {
      return LANDING_DEFAULTS;
    }
    return {
      hero: { ...LANDING_DEFAULTS.hero, ...(saved.hero || {}) },
      plans: Array.isArray(saved.plans) && saved.plans.length ? saved.plans : LANDING_DEFAULTS.plans,
      faq: Array.isArray(saved.faq) && saved.faq.length ? saved.faq : LANDING_DEFAULTS.faq,
    };
  }, LANDING_DEFAULTS);
}
