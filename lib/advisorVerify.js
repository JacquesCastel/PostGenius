// Conseiller éditorial : relecture factuelle indépendante (logique pure ; l'appel au modèle est dans la route).
// Réutilise le vérificateur indépendant mesuré (lib/verifierPrompt.mjs, protocole v2). Il reçoit le brief (avec les précisions de l'auteur),
// le profil de marque, les sources réellement disponibles et le texte. Il ne reçoit ni raisonnement de rédaction, ni ancien avis.
import { VERIFIER_SYSTEM, verifierUserPrompt, parseVerifierOutput, anomaliesOf, VERIFIER_PROMPT_VERSION } from "./verifierPrompt.mjs";
import { alertId, locatePassage } from "./advisorReview.js";

export const MAX_ALERTS = 8;
export const MAX_TEXT_CHARS = 6000;
export const DISCLAIMER = "Avis d'un relecteur automatique, qui a lu le brief, votre profil et le texte. Ce n'est pas une preuve : c'est à vous de décider.";
const ACTIONS = {
  unsupported: "Confirmez si c'est exact. Sinon, retirez le passage ou reformulez-le au conditionnel.",
  to_confirm: "Confirmez si c'est exact, ou précisez-le dans le texte.",
};
export const ALERT_TITLES = { unsupported: "Ajout du rédacteur", to_confirm: "À confirmer" };

export function buildVerifyPrompt({ brief, profile, sourcesBlock, text }) {
  return { system: VERIFIER_SYSTEM, user: verifierUserPrompt({ briefText: brief, profile, postText: text, sourcesBlock: sourcesBlock || undefined }) };
}

const STOP = new Set("dans pour avec cette sont leur leurs nous vous plus être avoir fait faire comme mais aussi entre très sans sous chez".split(" "));
const toks = (t) => new Set((String(t).toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ]{4,}/g) ?? []).filter((w) => !STOP.has(w)));
export function overlap(a, b) { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / Math.min(A.size, B.size); }

// Texte du profil servant à reconnaître une pratique habituelle documentée (jamais traitée automatiquement comme un fait inventé du cas).
const profileText = (p) => [p?.businessDescription, p?.market, p?.commGoals, p?.editorialLine, p?.headline].filter(Boolean).join(" ");

// Sortie du vérificateur → alertes de produit. Trois catégories de lecture :
//  - unsupported : affirmation factuelle non étayée (gravité « bloquante » du vérificateur) ;
//  - to_confirm  : information à confirmer (gravité « modérée », pratique décrite dans le profil, ou passage introuvable) ;
//  - interprétations / convictions : jamais une alerte (listées à part, repliées).
// Les remarques « mineures » (remerciements, qualificatifs vagues) sont écartées. Rien ici ne bloque une publication.
export function mapVerifierToAlerts({ parsed, text, profile }) {
  const pt = profileText(profile);
  let alerts = anomaliesOf(parsed).filter((c) => c.gravite !== "mineure" && c.quote).map((c) => {
    const loc = locatePassage(text, c.quote);
    let category = c.gravite === "bloquante" ? "unsupported" : "to_confirm";
    let justification = c.justification;
    if (category === "unsupported" && pt && overlap(c.quote, pt) >= 0.5) { category = "to_confirm"; justification = `Pratique ou conviction proche de ce que décrit votre profil. ${justification}`.trim(); }
    if (!loc) category = "to_confirm";
    return { id: alertId(c.quote), category, title: ALERT_TITLES[category], quote: c.quote, problem: c.problem, justification, action: ACTIONS[category], found: Boolean(loc), pos: loc ? loc.start : Infinity };
  });
  // doublons et passages contenus dans un autre passage signalé
  const seen = new Set();
  alerts = alerts.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  alerts = alerts.filter((a, i) => !alerts.some((b, j) => j !== i && b.quote.length > a.quote.length && b.quote.includes(a.quote)));
  alerts.sort((a, b) => (a.category === b.category ? a.pos - b.pos : a.category === "unsupported" ? -1 : 1));
  alerts = alerts.slice(0, MAX_ALERTS).map(({ pos, ...rest }) => rest);
  const interpretations = (parsed?.claims ?? []).filter((c) => c.category === "interpretation" && c.quote).slice(0, 8).map((c) => c.quote);
  // faits établis par le brief : servent à lire le post par origine (jamais une alerte)
  const established = (parsed?.claims ?? []).filter((c) => c.category === "fait_etabli" && c.quote).slice(0, 8).map((c) => c.quote);
  return { alerts, interpretations, established, version: VERIFIER_PROMPT_VERSION };
}
