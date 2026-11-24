// Qualification d'un post à partir de ce qui existe déjà : aucune table, aucune saisie en plus. Chaque valeur garde sa PROVENANCE.
// PUR : aucun accès base ni réseau.
//
// Seul l'objectif est qualifié ici (la seule dimension éditoriale renseignée par un humain sur les posts mesurés : le plan de campagne). Il est saisi en texte libre
// (« Faire connaître la méthode et générer des demandes ») : on le ramène à une catégorie, la PREMIÈRE évoquée l'emportant (l'objectif principal vient en premier).
// Ce n'est donc pas une donnée certaine : c'est une lecture par règles, signalée comme telle partout où elle sert.

export const OBJECTIVES = ["notoriété", "leads", "recrutement", "expertise", "autre"];

const RULES = [
  ["notoriété", /notori|visibilit|faire connaitre|se faire connaitre|image de marque|awareness|reconnaissance|rayonnement/],
  ["leads", /\blead|prospect|demande|rendez-vous|\brdv\b|inscription|conversion|contact|devis|vente|commercial|opportunit/],
  ["recrutement", /recrut|candidat|marque employeur|talent|embauche|attractivit|rejoindre/],
  ["expertise", /expertise|autorite|pedagog|demontr|credibilit|thought leader|positionnement|savoir-faire|legitimit/],
];
const strip = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Texte libre → catégorie ; null si le texte est vide ou n'est pas un texte
export function normalizeObjective(text) {
  if (typeof text !== "string") return null;
  const t = strip(text).trim();
  if (!t) return null;
  let best = null, bestAt = Infinity;
  for (const [name, re] of RULES) { const m = re.exec(t); if (m && m.index < bestAt) { best = name; bestAt = m.index; } }
  return best ?? "autre";
}

// Objectif d'un post : plan de campagne › campagne › proposition « Que publier ? ». Renvoie { value, provenance } ou null (non qualifié).
export function qualifyObjective({ campaignPost, campaign, editorialReco } = {}) {
  const sources = [
    [campaignPost?.objective, "plan de campagne"],
    [campaign?.objective, "campagne"],
    [editorialReco?.objective, "proposition « Que publier ? »"],
  ];
  for (const [text, provenance] of sources) { const value = normalizeObjective(text); if (value) return { value, provenance }; }
  return null;
}

// Part des posts qualifiés sur l'objectif. La dimension ne sert que si au moins la moitié des posts le sont ET s'il y a au moins deux valeurs à comparer.
export function objectiveCoverage(rows) {
  const total = rows.length;
  const values = rows.map((r) => r.objective).filter((v) => v != null);
  const distinct = new Set(values).size;
  const share = total ? values.length / total : 0;
  return { qualified: values.length, total, share, distinct, usable: total > 0 && share >= 0.5 && distinct >= 2 };
}
