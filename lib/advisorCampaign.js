// Conseiller éditorial dans les campagnes : texte de « brief d'origine » donné au vérificateur pour une publication du plan.
// Pur (navigateur et serveur). Principe : seuls les éléments fournis par l'auteur valent comme faits. Les règles et les interdits du brief
// ne sont pas des faits : ils ne sont pas transmis. Les « faits à confirmer » le sont, mais signalés comme non établis.

export const CAMPAIGN_FACTS_MAX = 4500;
export const ITEM_BRIEF_MAX = 1200;

// Faits de la campagne (brief structuré + précisions enregistrées avec la campagne), calculés côté serveur une fois par plan.
export function campaignFacts(brief, extraContext = "") {
  const parts = [];
  const add = (label, v) => { const s = String(v ?? "").trim(); if (s) parts.push(`${label} :\n${s}`); };
  add("Contexte de la campagne", brief?.context);
  add("Publics visés", brief?.audiences);
  add("Objectif de la campagne", brief?.objective);
  add("Message à retenir", brief?.message);
  add("Précisions de l'auteur sur la campagne", String(extraContext ?? "").slice(0, 1200));
  return parts.join("\n\n").slice(0, CAMPAIGN_FACTS_MAX);
}

// Brief d'une publication : ce que l'auteur a demandé pour elle, puis les faits de la campagne.
export function campaignItemBrief(item, facts = "") {
  const lines = [];
  const add = (label, v) => { const s = String(v ?? "").trim(); if (s) lines.push(`${label} : ${s}`); };
  add("Sujet et angle", item?.angle);
  add("Objectif de la publication", item?.objective);
  add("Appel à l'action", item?.cta);
  add("Format", item?.format);
  const head = lines.join("\n").slice(0, ITEM_BRIEF_MAX - 300);
  const toConfirm = String(item?.toConfirm ?? "").trim().slice(0, 200);
  const unconfirmed = toConfirm ? `\nÉléments que l'auteur n'a PAS confirmés (ne pas les tenir pour établis) : ${toConfirm}` : "";
  const campaign = String(facts ?? "").trim();
  return `${head}${unconfirmed}${campaign ? `\n\n${campaign}` : ""}`.trim();
}
