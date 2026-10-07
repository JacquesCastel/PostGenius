// « Prochaine étape recommandée » : à partir du profil et de l'activité du client, la liste ordonnée des
// gestes qui améliorent le plus les posts, avec la raison de chacun. Fonctions pures (aucune base de données).
// Certaines étapes ne se présentent qu'avec le temps (après un premier post, 5 posts publiés, 10 posts
// publiés…) : le parcours du profil se prolonge ainsi au fil de l'usage au lieu de tout demander d'un coup.

export const SNOOZE_DAYS = 7; // « Plus tard » masque une étape pour une semaine

const has = (v) => typeof v === "string" && v.trim().length > 0;

// target : { type: "create" }, { type: "profile", field } (champ du profil à ouvrir, voir PROFILE_FIELD_STAGE)
// ou { type: "view", view } (écran de l'application : charte graphique, événements)
// why peut être une fonction (profil, activité) quand la raison dépend de ce que le client a déjà fait.
const STEPS = [
  {
    id: "first-post",
    when: (p, a) => a.draftCount === 0,
    title: "Générez votre premier post",
    why: "Le plus simple pour voir le copilote à l'œuvre : donnez un thème, il rédige à partir de votre profil.",
    cta: "Créer un post",
    target: { type: "create" },
  },
  {
    id: "habit",
    when: (p, a) => a.pendingSuggestions > 0,
    title: "Le copilote a repéré une habitude",
    why: "D'après vos modifications, il propose de l'ajouter à vos remarques : vos prochains posts en tiendront compte.",
    cta: "Voir la suggestion",
    target: { type: "profile", field: "remarks" },
  },
  {
    id: "identity",
    when: (p) => !has(p.headline) || !has(p.companyName) || !has(p.expertise),
    title: "Complétez votre identité",
    why: "Votre titre, votre entreprise et votre expertise donnent sa voix et sa légitimité à chaque post.",
    cta: "Compléter",
    target: { type: "profile", field: "headline" },
  },
  {
    id: "audience",
    when: (p) => !has(p.targetAudience) || !has(p.businessDescription),
    title: "Précisez votre cible",
    why: "Un post écrit pour tout le monde ne touche personne : dites au copilote à qui vous parlez et ce que vous faites pour eux.",
    cta: "Compléter",
    target: { type: "profile", field: "targetAudience" },
  },
  {
    id: "linkedin",
    when: (p, a, c) => !c.linkedinConnected,
    title: "Connectez LinkedIn",
    why: (p, a) => (a.draftCount >= 1 ? "Votre premier post est prêt : connectez LinkedIn pour le publier en un clic, et le programmer à l'heure voulue." : "Vos posts partiront en un clic, et à l'heure que vous aurez choisie."),
    cta: "Connecter",
    target: { type: "profile", field: "publishDays" },
  },
  {
    id: "voice",
    when: (p) => !p.styleImportedAt && !has(p.styleNotes),
    title: "Faites découvrir votre style au copilote",
    why: "Importez vos anciens posts : il en tire votre façon d'écrire, et choisit les exemples les plus proches de chaque sujet.",
    cta: "Importer mes posts",
    target: { type: "profile", field: "styleNotes" },
  },
  {
    id: "rhythm",
    when: (p) => !has(p.publishDays),
    title: "Choisissez vos jours de publication",
    why: "Le copilote planifie vos posts sur ces créneaux, sans que vous y pensiez.",
    cta: "Choisir",
    target: { type: "profile", field: "publishDays" },
  },
  {
    id: "first-campaign",
    when: (p, a, c) => c.canCampaigns && a.campaignCount === 0 && a.draftCount >= 1,
    title: "Lancez votre première campagne",
    why: "Une série de posts autour d'un thème, planifiée sur vos créneaux : le copilote prépare les posts, vous validez un exemple puis relisez avant publication.",
    cta: "Créer une campagne",
    target: { type: "view", view: "campaigns" },
  },
  {
    id: "brand",
    when: (p, a) => !a.hasBrandKit && a.draftCount >= 1,
    title: "Ajoutez votre charte graphique",
    why: "Vos couleurs, votre logo et votre police, saisis une seule fois, s'appliquent ensuite aux images et aux carrousels de vos posts.",
    cta: "Ouvrir la charte",
    target: { type: "view", view: "brand-kit" },
  },
  {
    id: "sources",
    when: (p, a) => a.knowledgeCount === 0 && a.draftCount >= 1,
    title: "Ajoutez une source",
    why: "Un document, un article ou un lien : vos posts s'appuient alors sur vos vrais faits et vos vrais chiffres.",
    cta: "Ajouter une source",
    target: { type: "profile", field: "knowledge" },
  },
  {
    id: "events",
    when: (p, a, c) => c.canEvents && a.eventCount === 0 && a.publishedCount >= 1,
    title: "Ajoutez vos prochains événements",
    why: "Salons, forums, conférences : le copilote prépare un post d'annonce avant et un post « jour J », avec l'image de l'événement.",
    cta: "Ajouter un événement",
    target: { type: "view", view: "events" },
  },
  {
    id: "remarks-first",
    when: (p, a) => a.remarksCount === 0 && a.publishedCount >= 5,
    title: "Dites ce que vous corrigez toujours",
    why: "Vous avez publié 5 posts : notez ce que vous changez le plus souvent, le copilote l'appliquera d'emblée.",
    cta: "Ajouter une remarque",
    target: { type: "profile", field: "remarks" },
  },
  {
    id: "sources-more",
    when: (p, a) => a.knowledgeCount === 1 && a.publishedCount >= 10,
    title: "Enrichissez vos sources",
    why: "Avec quelques documents de plus, le copilote trouve plus souvent un fait pertinent pour chaque sujet.",
    cta: "Ajouter une source",
    target: { type: "profile", field: "knowledge" },
  },
];

// profile : champs du profil ; activity : compteurs (voir /api/profile/progress) ; ctx : { linkedinConnected, snoozed }
// snoozed : { idÉtape: instantFinDuMasquage } ; renvoie les étapes à proposer, la plus utile d'abord.
export function nextSteps(profile, activity, { linkedinConnected = false, canEvents = false, canCampaigns = false, snoozed = {} } = {}, now = Date.now()) {
  const p = profile ?? {};
  const a = { draftCount: 0, publishedCount: 0, knowledgeCount: 0, remarksCount: 0, pendingSuggestions: 0, hasBrandKit: false, eventCount: 0, campaignCount: 0, ...(activity ?? {}) };
  return STEPS.filter((s) => s.when(p, a, { linkedinConnected, canEvents, canCampaigns }) && !(snoozed[s.id] > now)).map(({ when, why, ...step }) => ({ ...step, why: typeof why === "function" ? why(p, a) : why }));
}

// Masque une étape pendant SNOOZE_DAYS jours
export function snoozeUntil(now = Date.now()) {
  return now + SNOOZE_DAYS * 86400e3;
}
