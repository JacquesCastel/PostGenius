// Entreprise choisie pour un post : on pose les champs de l'entreprise PAR-DESSUS le profil de la personne.
// Fonction pure (client et serveur). Les champs « entreprise » sont remplacés en entier, même vides : un fait ou une
// cible de l'entreprise principale ne doit jamais fuiter dans un post écrit pour une autre. La voix de la personne
// (ton, consignes d'écriture, posts importés, expertise) reste la sienne.

export const CONTEXT_FIELDS = ["name", "role", "website", "businessDescription", "targetAudience", "market", "commGoals", "brandVoice", "themes", "editorialLine", "leadIcp"];

export function overlayProfile(base, ctx) {
  if (!ctx) return base;
  const v = (x) => (typeof x === "string" ? x : "");
  // Sujet personnel : ni entreprise, ni site, ni positionnement commercial ; le nom de la thématique devient un thème.
  if (ctx.kind === "personal") {
    return {
      ...base,
      companyName: "",
      website: "",
      businessDescription: v(ctx.businessDescription),
      targetAudience: v(ctx.targetAudience),
      market: "",
      commGoals: "",
      brandVoice: "",
      themes: [ctx.name, v(ctx.themes).trim()].filter(Boolean).join(", "),
      editorialLine: v(ctx.editorialLine),
    };
  }
  return {
    ...base,
    companyName: ctx.name,
    headline: v(ctx.role).trim() || base?.headline || "",
    website: v(ctx.website),
    businessDescription: v(ctx.businessDescription),
    targetAudience: v(ctx.targetAudience),
    market: v(ctx.market),
    commGoals: v(ctx.commGoals),
    brandVoice: v(ctx.brandVoice),
    themes: v(ctx.themes).trim() || base?.themes || "",
    editorialLine: v(ctx.editorialLine),
  };
}
