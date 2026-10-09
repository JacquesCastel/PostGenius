// Lignes du comparatif des offres, partagées par la page publique /tarifs et la page « Abonnement » de l'application.
// Fichier PUR (aucune dépendance serveur).
import { PLANS, PLAN_IDS } from "./plans";

// Lignes du comparatif. value(plan) → true (inclus) | false (non) | "texte"/nombre
export const COMPARE = [
  { label: "Posts générés par mois", value: (p) => (p.postsPerMonth == null ? "Illimité" : `${p.postsPerMonth}`) },
  { label: "Images IA par mois", value: (p) => (p.imagesPerMonth == null ? "Illimité" : p.imagesPerMonth === 0 ? false : `${p.imagesPerMonth}`) },
  { label: "Profil de rédaction (style, contexte)", value: () => true },
  { label: "Publication sur profil personnel", value: () => true },
  { label: "Programmation & pilote automatique", value: () => true },
  { label: "9 langues de rédaction & humeur éditoriale", value: () => true },
  { label: "Vidéo : kit de tournage, téléprompteur, import LinkedIn", value: () => true },
  { label: "Interactions LinkedIn (commenter, réagir)", value: () => true },
  { label: "Score d'engagement & optimisation des posts", value: (p) => p.scoring },
  { label: "Campagnes guidées par l'IA", value: (p) => p.campaigns },
  { label: "Veille connectée & inspirations", value: (p) => p.veille },
  { label: "Validation avant publication", value: (p) => p.campaigns },
  { label: "Statistiques détaillées", value: (p) => p.campaigns },
  { label: "Publication sur page entreprise", value: (p) => p.orgPublish },
  { label: "Clients gérés (une entreprise et sa page par client)", value: (p) => (p.id === "agence" ? "Illimité" : false) },
  { label: "Utilisateurs", value: (p) => (p.users > 1 ? `Jusqu'à ${p.users} (au-delà, sur contact)` : "1 personne") },
  { label: "Statistiques de page (impressions…)", value: (p) => p.orgStats },
  { label: "Module Événements (salons, forums, création sur LinkedIn)", value: (p) => p.events },
  { label: "Support prioritaire", value: (p) => p.id === "agence" },
];

// Première offre (dans l'ordre Essentiel < Pro < Agence) qui inclut cette ligne, ou null
export function unlockedBy(row) {
  return PLAN_IDS.find((id) => {
    const v = row.value(PLANS[id]);
    return v !== false && v != null;
  }) ?? null;
}
