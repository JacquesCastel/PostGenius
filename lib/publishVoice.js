// Où le post sera publié → qui parle. Le même profil sert à la personne et à l'entreprise ;
// ce bloc dit au modèle quelle voix adopter pour ce post (« je » du profil perso, « nous » de la page).

const ORG_URN = /^urn:li:organization:\d+$/;

export const isOrgUrn = (t) => typeof t === "string" && ORG_URN.test(t);

// Cible LinkedIn d'un brouillon ("person" | urn de page) → voix
export const voiceOfTarget = (target) => (isOrgUrn(target) ? "org" : "person");

// Valeur d'un sélecteur « Publier en tant que » : "person" | urn | "both:urn" (deux versions adaptées)
export function parsePublishAs(value) {
  const v = String(value ?? "person");
  if (v.startsWith("both:") && isOrgUrn(v.slice(5))) return { kind: "both", orgUrn: v.slice(5) };
  if (isOrgUrn(v)) return { kind: "org", orgUrn: v };
  return { kind: "person", orgUrn: null };
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

// kind : "person" | "org" ; pageName : nom de la page entreprise (facultatif)
export function publishVoiceBlock(kind, pageName) {
  if (kind === "org") {
    const name = clean(pageName);
    return `\n\nOÙ CE POST SERA PUBLIÉ : la PAGE ENTREPRISE${name ? ` « ${name} »` : ""}. Écris avec la voix de la marque, pas celle d'une personne :
- parle à la première personne du pluriel (« nous ») ou au nom de la marque ; jamais « je », jamais d'anecdote personnelle de l'auteur ;
- parle de ce que fait l'entreprise pour sa cible : offre, clients, équipe, résultats, convictions de la marque ;
- garde le niveau de langue, le tutoiement ou vouvoiement et les consignes de style, mais la personne grammaticale est celle de la marque (même si les exemples de posts de l'auteur sont écrits en « je »).`;
  }
  return `\n\nOÙ CE POST SERA PUBLIÉ : le PROFIL PERSONNEL de l'auteur. Écris à la première personne (« je »), avec sa voix, son vécu et son point de vue ; l'entreprise n'est qu'un contexte, pas le sujet du post (évite le ton institutionnel et le « nous » de marque).`;
}
