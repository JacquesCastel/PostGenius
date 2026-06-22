// Contenu éditable des pages de pied de page (CGU, confidentialité, mentions légales).
// Stocké dans SiteContent avec des clés "page-cgu", "page-confidentialite", "page-mentions-legales".
// getFooterPage(key) lit depuis la DB et fusionne sur les défauts.

import { prisma } from "./db";

export const FOOTER_PAGE_KEYS = ["cgu", "confidentialite", "mentions-legales"];

export const FOOTER_PAGE_LABELS = {
  "cgu": "Conditions générales d'utilisation",
  "confidentialite": "Politique de confidentialité",
  "mentions-legales": "Mentions légales",
};

export const FOOTER_PAGE_DEFAULTS = {
  "cgu": {
    title: "Conditions générales d'utilisation",
    sections: [
      {
        heading: "1. Objet",
        body: "LinkeePost est un service SaaS d'aide à la création et à la gestion de campagnes de publication LinkedIn : génération de contenus assistée par IA, programmation, publication via l'API officielle LinkedIn et statistiques.",
      },
      {
        heading: "2. Compte et essai",
        body: "L'inscription est ouverte aux professionnels. L'essai gratuit dure 14 jours, sans engagement ni carte bancaire. Au-delà, l'accès aux fonctionnalités nécessite un abonnement payant, résiliable à tout moment avec effet en fin de période.",
      },
      {
        heading: "3. Responsabilité sur les contenus",
        body: "Les contenus générés par l'IA sont des propositions : l'utilisateur reste seul responsable des publications effectuées sur ses comptes LinkedIn, de leur véracité et de leur conformité aux conditions d'utilisation de LinkedIn et au droit applicable. Le mode de validation avant publication est disponible à cet effet.",
      },
      {
        heading: "4. Usage raisonnable",
        body: "Les plans « illimités » s'entendent dans le cadre d'un usage individuel raisonnable. Des limites techniques peuvent s'appliquer pour préserver la qualité du service. Tout usage abusif, automatisé hors fonctionnalités prévues, ou contraire aux CGU de LinkedIn peut entraîner la suspension du compte.",
      },
      {
        heading: "5. Disponibilité",
        body: "Le service est fourni « en l'état », avec une cible de disponibilité élevée mais sans garantie de continuité absolue, notamment en cas de maintenance ou d'indisponibilité des services tiers (LinkedIn, fournisseurs d'IA).",
      },
      {
        heading: "6. Tarifs et facturation",
        body: "Les tarifs en vigueur sont affichés sur la page d'accueil, en euros hors taxes. L'abonnement est mensuel, payable d'avance, sans engagement de durée.",
      },
      {
        heading: "7. Droit applicable",
        body: "Les présentes CGU sont soumises au droit français. Tout litige relèvera des tribunaux compétents de [À COMPLÉTER : ville du siège].",
      },
    ],
  },

  "confidentialite": {
    title: "Politique de confidentialité",
    sections: [
      {
        heading: "Responsable de traitement",
        body: "[À COMPLÉTER : raison sociale] — contact : contact@postgenius.network",
      },
      {
        heading: "Données collectées",
        body: "Données de compte (email, nom, mot de passe chiffré), profil de rédaction (contexte métier, préférences), contenus créés (posts, campagnes, images générées), jetons d'accès LinkedIn (chiffrés en base, révocables à tout moment), sources de veille, données de consommation du service, et — si vous le connectez — statistiques de votre profil LinkedIn via notre partenaire Phyllo.",
      },
      {
        heading: "Finalités et bases légales",
        body: "Fourniture du service (exécution du contrat) : génération de contenus, publication LinkedIn, programmation, statistiques. Facturation et obligations légales. Amélioration du service et suivi de consommation (intérêt légitime).",
      },
      {
        heading: "Sous-traitants",
        body: "Hetzner (hébergement, Allemagne), Neon (base de données, UE), Anthropic (génération de texte), OpenAI (génération d'images), LinkedIn (publication via API officielle), Phyllo (statistiques de profil, sur connexion explicite), Brevo (emails transactionnels). Les contenus transmis aux services d'IA le sont uniquement pour produire vos posts.",
      },
      {
        heading: "Durées de conservation",
        body: "Les données sont conservées pendant la durée de vie du compte, puis supprimées dans un délai de 30 jours après sa clôture. Les jetons LinkedIn expirent automatiquement (≈60 jours) et sont supprimés à la déconnexion du compte LinkedIn.",
      },
      {
        heading: "Vos droits",
        body: "Conformément au RGPD, vous disposez de droits d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez-les par email à contact@postgenius.network. Vous pouvez introduire une réclamation auprès de la CNIL (cnil.fr).",
      },
      {
        heading: "Cookies",
        body: "LinkeePost n'utilise que des cookies strictement nécessaires au fonctionnement (session d'authentification). Aucun cookie publicitaire ou de mesure d'audience tierce.",
      },
    ],
  },

  "mentions-legales": {
    title: "Mentions légales",
    sections: [
      {
        heading: "Éditeur du site",
        body: "LinkeePost est édité par [À COMPLÉTER : raison sociale], [À COMPLÉTER : forme juridique, ex. SASU au capital de X €], immatriculée au RCS de [À COMPLÉTER : ville] sous le numéro [À COMPLÉTER : SIREN], dont le siège social est situé [À COMPLÉTER : adresse].\nN° TVA intracommunautaire : [À COMPLÉTER]\nDirecteur de la publication : [À COMPLÉTER : nom]\nContact : contact@postgenius.network",
      },
      {
        heading: "Hébergement",
        body: "Le site est hébergé par Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Allemagne — www.hetzner.com.\nBase de données hébergée par Neon Inc. (région UE — Francfort).",
      },
      {
        heading: "Propriété intellectuelle",
        body: "L'ensemble des éléments du site (textes, interface, marque, logo) est protégé par le droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite. LinkedIn est une marque déposée de LinkedIn Corporation ; LinkeePost est un service indépendant, non affilié à LinkedIn.",
      },
      {
        heading: "Données personnelles",
        body: "Les modalités de traitement des données personnelles sont détaillées dans la politique de confidentialité accessible depuis le pied de page.",
      },
    ],
  },
};

// Lit le contenu d'une page depuis la DB, avec fallback sur les défauts.
export async function getFooterPage(key) {
  if (!FOOTER_PAGE_KEYS.includes(key)) return null;
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: `page-${key}` } });
    if (!row?.value) return FOOTER_PAGE_DEFAULTS[key];
    const saved = JSON.parse(row.value);
    return {
      title: saved.title || FOOTER_PAGE_DEFAULTS[key].title,
      sections: Array.isArray(saved.sections) && saved.sections.length
        ? saved.sections
        : FOOTER_PAGE_DEFAULTS[key].sections,
    };
  } catch {
    return FOOTER_PAGE_DEFAULTS[key];
  }
}
