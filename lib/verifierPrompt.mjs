// Vérificateur éditorial INDÉPENDANT (banc d'essai hors ligne, voir docs/eval-editorial/verifier-protocole.md).
// Il reçoit le brief, le profil de l'entreprise et le post. Il ne reçoit ni le raisonnement interne de l'auteur, ni son classement, ni son audit, ni son advisory.
// Version figée du prompt : toute modification crée une nouvelle version (VERIFIER_PROMPT_VERSION) et invalide les sorties de la précédente.
import crypto from "node:crypto";

export const VERIFIER_PROMPT_VERSION = "v2";

export const VERIFIER_SYSTEM = `Tu es un vérificateur éditorial indépendant. Tu n'as pas écrit ce texte et tu ne sais pas pourquoi il a été écrit ainsi. On te donne le brief que l'auteur a reçu, le profil de l'entreprise qui publie et le post. Ta seule tâche : repérer les affirmations du post sur le cas concret qui ne sont pas établies par le brief ou par le profil. Tu réponds uniquement par un objet JSON valide, sans texte autour.`;

const PROFILE_LABELS = [["companyName", "Entreprise"], ["headline", "Titre"], ["businessDescription", "Activité"], ["targetAudience", "Public cible"], ["market", "Marché et positionnement"], ["commGoals", "Objectifs de communication"], ["editorialLine", "Ligne éditoriale"]];

// `sourcesBlock` (facultatif, usage produit) : sources effectivement disponibles pour l'auteur ; sans lui, le texte du prompt v2 est strictement inchangé.
export function verifierUserPrompt({ briefText, profile, postText, sourcesBlock }) {
  const profileLines = PROFILE_LABELS.filter(([k]) => profile?.[k]).map(([k, l]) => `- ${l} : ${profile[k]}`).join("\n") || "- (aucun profil renseigné)";
  return `BRIEF — les seuls faits établis sur le cas :
<<<
${briefText}
>>>

${sourcesBlock ? `SOURCES DISPONIBLES — leurs faits sont établis eux aussi :\n<<<\n${sourcesBlock}\n>>>\n\n` : ""}PROFIL DE L'ENTREPRISE QUI PUBLIE — ce qu'elle est, croit et fait habituellement ; ce n'est pas ce qui s'est passé dans ce cas :
${profileLines}

POST À VÉRIFIER :
<<<
${postText}
>>>

Consignes
1. Relève les affirmations du post sur le cas concret (10 au plus, les plus importantes), chacune avec le passage EXACT copié du post.
2. Classe chaque affirmation :
- fait_etabli : dit dans le brief, ou reformulation fidèle.
- interpretation : conviction, principe général, lecture métier, ou hypothèse EXPLICITEMENT présentée comme telle par sa formulation (conditionnel, « peut-être », « nous pensons », « cela suggère »). Une pratique habituelle de l'entreprise décrite par son profil, présentée comme principe, est une interprétation légitime.
- non_etayee : affirmation présentée comme réelle sur le cas (présent ou passé de l'indicatif) qui n'est ni dans le brief ni dans le profil : acteur, décision, durée, date, cause ou origine, résultat, citation, détail de programme ou de méthode, réaction de personnes, ancienneté, engagement futur, exemple donné pour réel.
- resultat_abusif : résultat, effet ou explication présentés comme acquis alors que le brief les donne comme incertains, absents ou contradictoires ; ou explication qui concilie deux informations contradictoires du brief.
3. Juge d'après la FORMULATION du post, pas d'après l'intention supposée de l'auteur : une phrase affirmative, au présent ou au passé, sur le cas est un fait (étayé ou non), même si elle aurait pu être une hypothèse.
4. Pour chaque non_etayee ou resultat_abusif : problem (une phrase), justification (ce que dit ou ne dit pas le brief) et gravite :
- « bloquante » : l'affirmation porte l'argument du post ou donne un fait précis sur le cas qu'un lecteur retiendrait : un acteur, une décision, une durée ou une date, une cause ou une origine, un résultat ou un gain, une citation, un détail de programme ou de méthode, une réaction de personnes, une ancienneté ou un caractère inédit, un engagement futur, un exemple présenté comme réel, ou une explication qui concilie deux informations contradictoires du brief.
- « moderee » : détail secondaire du cas, sans incidence sur l'argument.
- « mineure » : remerciement, sentiment, qualificatif vague (« récent », « sérieux »), formule de politesse ou généralité de métier.
Les fait_etabli et interpretation n'ont ni problem ni justification, et ont gravite « mineure ».
Exemple de calibrage (brief et post sans rapport avec le cas à vérifier). Brief : « Une PME a reçu une demande de devis pour une pièce en inox ; elle étudie la faisabilité. » Post : « Nous avons répondu en 48 h avec une alternative 15 % moins chère. Le client a validé. Merci à toute l'équipe ! » → « en 48 h » : non_etayee, bloquante (durée) ; « 15 % moins chère » : non_etayee, bloquante (résultat) ; « Le client a validé » : non_etayee, bloquante (décision) ; « Merci à toute l'équipe » : non_etayee, mineure (remerciement).
Réponds uniquement par : {"claims":[{"quote":"…","category":"fait_etabli|interpretation|non_etayee|resultat_abusif","gravite":"bloquante|moderee|mineure","problem":"…","justification":"…"}]}`;
}

export const verifierPromptHash = () => crypto.createHash("sha256").update(VERIFIER_SYSTEM + verifierUserPrompt({ briefText: "{brief}", profile: null, postText: "{post}" })).digest("hex").slice(0, 12);

export const CATEGORIES = ["fait_etabli", "interpretation", "non_etayee", "resultat_abusif"];
export const GRAVITES = ["bloquante", "moderee", "mineure"];

// Extrait le JSON de la réponse et le valide ; null si invalide.
export function parseVerifierOutput(raw) {
  const m = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  if (!Array.isArray(j.claims)) return null;
  const claims = j.claims.slice(0, 12).map((c) => ({
    quote: typeof c?.quote === "string" ? c.quote.trim().slice(0, 400) : "",
    category: CATEGORIES.includes(c?.category) ? c.category : null,
    gravite: GRAVITES.includes(c?.gravite) ? c.gravite : "mineure",
    problem: typeof c?.problem === "string" ? c.problem.trim().slice(0, 300) : "",
    justification: typeof c?.justification === "string" ? c.justification.trim().slice(0, 400) : "",
  })).filter((c) => c.category);
  return { claims };
}

export const anomaliesOf = (parsed) => (parsed?.claims ?? []).filter((c) => c.category === "non_etayee" || c.category === "resultat_abusif");
