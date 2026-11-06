// Règles d'écriture LinkedIn — source unique partagée par le générateur de posts
// (prompts) et le score d'engagement (heuristique), pour qu'un post généré respecte
// par construction les critères sur lesquels il sera ensuite noté.
// PUR : utilisable côté client comme côté serveur.
//
// Principe éditorial : PYRAMIDE INVERSÉE (l'essentiel d'abord, les détails ensuite,
// le secondaire en dernier), pas une formule imposée. Seules restent obligatoires les
// contraintes réellement propres à LinkedIn (le « voir plus », le risque de spam) ;
// le reste (tension de l'accroche, question finale, CTA, hashtags, emoji) est une
// option que le texte peut saisir s'il s'y prête, jamais une case à cocher.

export const RULES = {
  hookMax: 90, // 1re ligne : seule visible avant « voir plus »
  hookSoftMax: 140,
  lengthMin: 400,
  lengthMax: 1600,
  lengthSoftMin: 200,
  lengthSoftMax: 2200,
  hashtagsMax: 5, // au-delà, ça fait spam — pas de minimum imposé
  emojisMax: 6, // zéro est tout aussi valable
};

// Tension d'une accroche : question ou promesse introduite par « : ». Le chiffre n'en fait plus partie : le score ne doit pas
// récompenser un chiffre, que le générateur ne peut pas connaître (voir ANTI_INVENTION_INSTRUCTION).
export const TENSION_REGEX = /\?|:/;

// Appel à l'action reconnu par le score, et exemples cités au générateur
export const CTA_REGEX = new RegExp(
  [
    // français
    "commentez|partagez|votre avis|qu'en pensez|t[ée]l[ée]chargez|inscrivez|contactez|r[ée]servez|d[ée]couvrez|en savoir plus|lien en commentaire|dites-moi|r[ée]agissez",
    // anglais
    "let me know|what do you think|your thoughts|share your|drop a comment|comment below|tell me|link in (the )?comments|dm me|learn more|follow me|sign up|download|book a|get in touch|reach out",
    // espagnol
    "comenta|comparte|cu[ée]ntame|qu[ée] opinas|d[ée]jame|enlace en (el )?comentario|suscr[ií]bete|desc[aá]rga|cont[aá]ctame|reserva",
    // allemand
    "kommentier|teile|schreib mir|was denkst du|link in den kommentaren|folge mir|lade .* herunter|melde dich|kontaktiere",
    // italien
    "commenta|condividi|fammi sapere|cosa ne pensi|link nei commenti|seguimi|scarica|contattami|prenota",
    // portugais
    "comente|compartilhe|me conte|o que voc[êe] acha|link nos coment[áa]rios|siga-me|baixe|entre em contato|reserve",
    // néerlandais
    "reageer|deel dit|laat (het )?me weten|wat vind je|link in de reacties|volg me|neem contact|boek",
    // arabe
    "شاركونا|شاركني|ما رأيك|ما رأيكم|اترك(وا)? تعليق|علّق(وا)?|الرابط في التعليقات|تابعني|اشترك|حمّل|تواصل معي|احجز|أخبرني",
    // polonais
    "skomentuj|podziel się|daj znać|co sądzisz|co myślisz|link w komentarzu|obserwuj|pobierz|skontaktuj|zarezerwuj|napisz do mnie",
  ].map((p) => `(${p})`).join("|"),
  "i"
);
export const CTA_EXAMPLES = ["« Dites-moi en commentaire… »", "« Partagez votre avis »", "« Qu'en pensez-vous ? »"];

// Garde anti-invention : l'IA ne connaît pas les vrais clients, études ou chiffres de
// l'auteur. Sans ce garde-fou, un thème comme « les résultats de notre étude » la pousse
// à inventer des statistiques présentées comme réelles. Les chiffres/noms que l'auteur a
// lui-même donnés (thématique, profil, brief) restent utilisables tels quels.
export const ANTI_INVENTION_INSTRUCTION = `N'invente jamais de nom, de chiffre, de statistique ou de fait présenté comme réel que tu ne connais pas : tu n'as pas accès aux vraies données, études ou clients de l'auteur. Si la demande n'en fournit pas, formule l'idée en termes généraux (« une part importante des… », « beaucoup de… ») ou comme un cas type clairement présenté comme tel (ex. « Prenons l'exemple d'un consultant qui… »), jamais comme un fait précis et vérifiable. Tu peux en revanche reprendre tel quel un chiffre, un nom ou un fait que la thématique, le profil ou le brief t'ont explicitement donné.`;

// Moteur B : frontière factuelle. Distingue faits documentés, interprétations et informations manquantes ; interdit de fabriquer les faits
// qui servent à démontrer une idée, sans interdire la conviction. Les faits documentés viennent de la demande, du profil, des sources et de la matière
// source, ou de connaissances générales solides qui ne portent pas sur la situation propre de l'auteur.
export const FACT_BOUNDARY_INSTRUCTION = `RIGUEUR FACTUELLE — avant d'écrire, range ce que tu sais en trois catégories :
1. FAITS DOCUMENTÉS : ce que la demande, le profil, les sources ou la matière source établissent explicitement sur la situation de l'auteur, et les connaissances générales solides et vérifiables qui ne portent pas sur sa situation propre.
2. INTERPRÉTATIONS : ce que ces faits t'inspirent (conviction, lecture métier, hypothèse). Elles sont bienvenues, formulées comme des positions de l'auteur (« nous pensons que », « cela suggère », conditionnel), jamais comme des constats.
3. INFORMATIONS MANQUANTES : tout le reste.
Sur la situation concrète de l'auteur, n'affirme que des faits de la catégorie 1. N'ajoute jamais, même pour rendre le récit plus convaincant : un acteur ou une décision attribués à quelqu'un, une durée, une date, une cause ou une origine, un résultat ou un gain, une citation, un détail de programme ou de méthode, une réaction de personnes, un exemple présenté comme réel, une référence ou une obligation que tu ne peux pas établir. Un fait absent reste absent : construis le post sur ce qui est établi, sur le raisonnement, et sur la question que cette situation ouvre.
Si deux informations se contredisent, n'affirme aucune des deux comme établie et n'invente aucune explication qui les concilie : bâtis le texte sur ce qui reste vrai quelle que soit la version (par exemple l'importance de vérifier ce qui a été mesuré), ou reste dans le conditionnel.
Garde une position claire et engagée : la rigueur porte sur les faits, pas sur la conviction.`;

// Moteur B : conseil éditorial structuré, champ optionnel « advisory » (mesuré, non affiché pour l'instant).
export const ADVISORY_STATUSES = ["ready", "verify", "blocked"];
export const ADVISORY_JSON_FORMAT = `"advisory": {"status": "ready | verify | blocked", "issue": "...", "toClarify": ["..."], "recommendation": "..."}`;
export const ADVISORY_INSTRUCTION = `Le champ "advisory" s'adresse à l'auteur (pas aux lecteurs du post) : il dit si les informations fournies suffisent à publier ce post sans rien inventer. Rédige-le dans la langue du post.
- status : "ready" (les faits fournis suffisent), "verify" (publiable après vérification ou complément d'un point précis), "blocked" (informations contradictoires, ou trop minces pour fonder un post sans inventer).
- issue : le problème identifié, en une phrase ("" si ready). Distingue ce qui est établi, ce qui est interprété et ce qui manque.
- toClarify : de 0 à 4 informations précises à clarifier ou à vérifier ([] si ready).
- recommendation : le conseil éditorial, en une phrase ("" si ready).
Ne mets jamais "ready" si ton texte repose sur un fait que la demande ne fournit pas.`;

// Nettoie l'objet « advisory » renvoyé par le modèle ; null s'il est absent ou invalide (le champ reste optionnel).
export function cleanAdvisory(a) {
  if (!a || typeof a !== "object" || !ADVISORY_STATUSES.includes(a.status)) return null;
  const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  return {
    status: a.status,
    issue: str(a.issue, 300),
    toClarify: Array.isArray(a.toClarify) ? a.toClarify.map((x) => str(x, 200)).filter(Boolean).slice(0, 4) : [],
    recommendation: str(a.recommendation, 300),
  };
}

// Moteur B2 : B + rôle de l'auteur, interdits étendus (ancienneté, engagements futurs, réactions, reproche conjectural),
// distinction contradiction factuelle / opposition d'idées, références réglementaires non complétées.
export const FACT_BOUNDARY_B2 = `RIGUEUR FACTUELLE — avant d'écrire, range ce que tu sais en trois catégories :
1. FAITS DOCUMENTÉS : ce que la demande, le profil, les sources ou la matière source établissent explicitement sur la situation de l'auteur.
2. INTERPRÉTATIONS : ce que ces faits t'inspirent (conviction, lecture métier, hypothèse). Elles sont bienvenues, formulées comme des positions de l'auteur (« nous pensons que », « cela suggère », conditionnel), jamais comme des constats.
3. INFORMATIONS MANQUANTES : tout le reste.
RÔLE DE L'AUTEUR — le profil dit ce que l'auteur est, croit et fait habituellement ; il ne dit pas ce qui s'est passé dans CE cas. N'attribue à l'auteur (« nous avons… », « on a… », son nom comme acteur) aucune action que la demande ne dit pas explicitement qu'il a réalisée : décris le cas à la troisième personne (« une entreprise industrielle », « les deux équipes ») ou en général. Tu peux en revanche employer la première personne pour ses convictions, sa posture et ses pratiques habituelles documentées dans son profil (« nous lisons les plans en amont »), présentées comme des principes et non comme un épisode.
INTERDITS — sur la situation concrète, n'ajoute jamais : un acteur ou une décision attribués à quelqu'un, une durée, une date, une cause ou une origine, un résultat ou un gain, une citation, un détail de programme ou de méthode, une réaction de personnes, une ancienneté ou un caractère inédit (« depuis longtemps », « première »), un engagement futur (« nous mesurerons »), un exemple présenté comme réel. Une cause possible reste une hypothèse au conditionnel portant sur un mécanisme général, jamais une faute prêtée à l'entreprise. Un fait absent reste absent : construis sur ce qui est établi, sur le raisonnement et sur la question que la situation ouvre.
CONTRADICTION — si la demande contient deux affirmations factuelles incompatibles sur le cas, n'en affirme aucune comme établie et n'invente aucune explication qui les concilie : bâtis le texte sur ce qui reste vrai quelle que soit la version (par exemple l'importance de vérifier ce qui a été mesuré), ou reste au conditionnel. Une opposition d'idées dans un raisonnement n'est pas une contradiction factuelle.
RÉGLEMENTAIRE, JURIDIQUE, NORMES — ne cite aucun texte, article, date, seuil ou obligation précis absent de la demande ou des sources fournies ; ne complète jamais un brief avec des références que tu ne peux pas vérifier. Une référence documentée dans la demande ou les sources peut être reprise.
Garde une position claire et engagée, et relie le fait au métier de la marque sous forme de raisonnement (par exemple : une planification qui change → des besoins transmis aux fournisseurs qui changent → un enjeu pour les achats). La rigueur porte sur les faits, pas sur la conviction.`;

// Moteur B2 : classement interne court, dans le même appel, jamais renvoyé au client (sauf EDITORIAL_DEBUG=1, pour la mesure).
export const ANALYSIS_INSTRUCTION_B2 = `Avant le texte, remplis le champ "analysis" (interne, jamais montré aux lecteurs) :
- facts : les faits établis par la demande qui fondent le post (5 au plus, très courts) ;
- missing : les faits absents dont le post pourrait être tenté de se servir (4 au plus) ;
- contradictions : les affirmations factuelles de la demande qui se contredisent sur le cœur du cas (2 au plus ; [] s'il n'y en a pas) ;
- centralFactMissing : true seulement si l'idée centrale du post ne peut pas être défendue avec les faits fournis sans en inventer ; l'absence de détails secondaires n'en fait pas un manque central ;
- regulatory : true si le sujet touche à une réglementation, au droit ou à des normes.`;
export const ANALYSIS_JSON_FORMAT_B2 = `"analysis": {"facts": ["..."], "missing": ["..."], "contradictions": [], "centralFactMissing": false, "regulatory": false}`;
export const ADVISORY_INSTRUCTION_B2 = `Le champ "advisory" s'adresse à l'auteur (pas aux lecteurs) et dit si les informations fournies suffisent à publier ce post sans rien inventer ; rédige-le dans la langue du post.
- status : "ready" (les faits suffisent), "verify" (publiable après vérification d'un point précis), "blocked" (contradiction factuelle centrale non résolue, ou faits trop minces pour fonder le post).
- issue : le problème, en une phrase ("" si ready) ; toClarify : de 0 à 4 vérifications précises (unité, périmètre, période, méthode, source…) ; recommendation : le conseil éditorial en une phrase.
Si status n'est pas "ready", ne dis jamais que le post est publiable, solide ou prêt.`;

const ACTUALITY_LINE = "Vérifier le statut et la date actuels des références réglementaires ou juridiques citées.";
const REASSURING = /(reste|demeure|est|serait|devient|semble)\s+(publiable|solide|prêt)|prêt à (être )?publi|peut (être )?publi|publiable (en l'état|tel quel)|post (est )?solide|si oui,? le post/gi;
// Vrai si le texte rassure sur la publication (hors négation : « n'est pas publiable »)
export function isReassuring(text) {
  const t = String(text ?? "");
  for (const m of t.matchAll(REASSURING)) {
    const before = t.slice(Math.max(0, m.index - 14), m.index).toLowerCase();
    if (!/(pas|non|jamais|plus|ne)\s*$|n'\s*$/.test(before)) return true;
  }
  return false;
}
export function cleanAnalysis(a) {
  if (!a || typeof a !== "object") return null;
  const list = (v, n, len) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim().slice(0, len) : "")).filter(Boolean).slice(0, n) : []);
  return { facts: list(a.facts, 5, 160), missing: list(a.missing, 4, 160), contradictions: list(a.contradictions, 2, 240), centralFactMissing: a.centralFactMissing === true, regulatory: a.regulatory === true };
}
const ORDER = { ready: 0, verify: 1, blocked: 2 };
// Statut d'advisory piloté par le classement (B2) : une contradiction factuelle centrale force "blocked", un fait central manquant ou un sujet
// réglementaire impose au moins "verify" ; hors "ready", aucune recommandation rassurante. Renvoie aussi des indicateurs de mesure.
export function finalizeAdvisoryB2(rawAdvisory, rawAnalysis) {
  const analysis = cleanAnalysis(rawAnalysis);
  const adv = cleanAdvisory(rawAdvisory);
  if (!adv && !analysis) return { advisory: null, analysis: null, guard: null };
  const modelStatus = adv?.status ?? "ready";
  const floor = analysis?.contradictions.length ? "blocked" : analysis?.centralFactMissing || analysis?.regulatory ? "verify" : "ready";
  const status = ORDER[floor] > ORDER[modelStatus] ? floor : modelStatus;
  let toClarify = adv?.toClarify ?? [];
  if (analysis?.regulatory && !toClarify.some((x) => /actualit|statut|à jour|date/i.test(x))) toClarify = [...toClarify, ACTUALITY_LINE].slice(0, 4);
  let issue = adv?.issue ?? "";
  if (status !== "ready" && !issue) issue = analysis?.contradictions.length ? `Informations contradictoires : ${analysis.contradictions.join(" / ")}` : analysis?.centralFactMissing ? "Un fait central manque pour défendre l'idée du post sans l'inventer." : "À vérifier avant publication.";
  let recommendation = adv?.recommendation ?? "";
  const reassuring = status !== "ready" && (isReassuring(recommendation) || isReassuring(issue));
  if (status !== "ready" && (!recommendation || reassuring)) recommendation = status === "blocked" ? "Ne publiez pas en l'état : clarifiez d'abord les points ci-dessus." : "Vérifiez les points ci-dessus avant de publier.";
  return { advisory: { status, issue, toClarify, recommendation }, analysis, guard: { raised: status !== modelStatus, from: modelStatus, reassuringReplaced: reassuring } };
}

// ── Moteur B2b : B2 condensée, « missing » contraignant, auto-audit du texte écrit, advisory piloté en code ──────────────────────────────
// L'audit est fait par le MÊME modèle, dans le même appel : c'est un auto-contrôle, jamais une vérification indépendante.
export const FACT_BOUNDARY_B2B = `RIGUEUR FACTUELLE — FAITS = ce que la demande, le profil et les sources établissent explicitement sur CE cas ; INTERPRÉTATIONS = convictions, lectures métier, hypothèses (bienvenues, formulées comme positions de l'auteur ou au conditionnel) ; INCONNU = tout le reste. Sur le cas concret, n'affirme que des faits. N'ajoute jamais, même pour convaincre : acteur ou décision attribués, durée, date, cause, résultat, citation, détail de programme ou de méthode, réaction de personnes, ancienneté (« depuis longtemps », « première »), engagement futur, exemple présenté comme réel, faute prêtée à l'entreprise.
RÔLE DE L'AUTEUR — le profil dit ce que l'auteur croit et fait habituellement, pas ce qui s'est passé dans ce cas. « Nous avons… » ou son nom comme acteur seulement si la demande dit qu'il a agi ; sinon troisième personne (« une entreprise industrielle ») ou propos général. Convictions, posture et pratiques habituelles du profil : première personne permise, comme principes.
CONTRADICTION — deux affirmations factuelles incompatibles : n'en affirme aucune, ne les concilie par aucune explication ; bâtis sur ce qui reste vrai (vérifier ce qui a été mesuré). Une opposition d'idées n'est pas une contradiction.
RÉGLEMENTAIRE — aucun texte, article, date, seuil ou obligation absent de la demande ou des sources.
MISSING — ce que tu y listes reste inconnu dans le texte : ni affirmé, ni supposé, ni « expliqué ».
Position claire et engagée : relie le fait au métier de la marque par un raisonnement (planification qui change → besoins transmis aux fournisseurs → enjeu achats). La rigueur porte sur les faits, pas sur la conviction.`;
export const ANALYSIS_INSTRUCTION_B2B = `Remplis les champs dans l'ordre. Avant le texte, "analysis" (interne) : missing = faits absents dont le post serait tenté de se servir (4 au plus, très courts) ; contradictions = affirmations factuelles incompatibles sur le cœur du cas (2 au plus, sinon []) ; regulatory = true si réglementation, droit ou normes.`;
export const ANALYSIS_JSON_FORMAT_B2B = `"analysis": {"missing": ["..."], "contradictions": [], "regulatory": false}`;
export const AUDIT_INSTRUCTION_B2B = `Juste après le texte, "audit" : relis ton texte. unsupported = affirmations FACTUELLES sur le cas non établies par la demande, le profil ou les sources, chacune avec le passage exact (quote) et la raison (why) ; 4 au plus, [] si aucune ; une cause, un résultat, une intention, une décision ou une ancienneté non fournis en sont. hypotheses = hypothèses ou jugements assumés (3 au plus, très courts).`;
export const AUDIT_JSON_FORMAT_B2B = `"audit": {"unsupported": [{"quote": "...", "why": "..."}], "hypotheses": ["..."]}`;
export const ADVISORY_INSTRUCTION_B2B = `"advisory" (pour l'auteur, dans la langue du post) : status "ready" | "verify" | "blocked" ; issue (une phrase, "" si ready) ; toClarify (0 à 4 vérifications précises : unité, périmètre, période, méthode, source…) ; recommendation (une phrase). Hors "ready", ne dis jamais que le post est publiable, solide ou prêt.`;

export function cleanAnalysisB2b(a) {
  if (!a || typeof a !== "object") return null;
  const list = (v, n, len) => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim().slice(0, len) : "")).filter(Boolean).slice(0, n) : []);
  return { missing: list(a.missing, 4, 160), contradictions: list(a.contradictions, 2, 240), regulatory: a.regulatory === true };
}
const norm = (t) => String(t ?? "").toLowerCase().replace(/[«»"“”'’]/g, "").replace(/\s+/g, " ").trim();
// Auto-audit : chaque affirmation non étayée est citée ; `found` indique si le passage cité figure bien dans le texte (une citation absente est suspecte).
export function cleanAudit(a, text) {
  if (!a || typeof a !== "object" || !Array.isArray(a.unsupported)) return null;
  const t = norm(text);
  const unsupported = a.unsupported.map((x) => ({ quote: typeof x?.quote === "string" ? x.quote.trim().slice(0, 240) : "", why: typeof x?.why === "string" ? x.why.trim().slice(0, 240) : "" }))
    .filter((x) => x.quote || x.why).slice(0, 4).map((x) => ({ ...x, found: x.quote ? t.includes(norm(x.quote)) : false }));
  const hypotheses = Array.isArray(a.hypotheses) ? a.hypotheses.map((x) => (typeof x === "string" ? x.trim().slice(0, 160) : "")).filter(Boolean).slice(0, 3) : [];
  return { unsupported, hypotheses };
}
// advisory piloté en code : contradiction centrale → blocked ; affirmation non étayée, sujet réglementaire ou audit absent → au moins verify ;
// ready uniquement sans aucune anomalie. L'audit est un auto-contrôle du modèle, pas une vérification indépendante.
export function finalizeAdvisoryB2b(rawAdvisory, rawAnalysis, rawAudit, text) {
  const analysis = cleanAnalysisB2b(rawAnalysis);
  const audit = cleanAudit(rawAudit, text);
  const adv = cleanAdvisory(rawAdvisory);
  if (!adv && !analysis && !audit) return { advisory: null, analysis: null, audit: null, guard: null };
  const modelStatus = adv?.status ?? "ready";
  const contradiction = (analysis?.contradictions.length ?? 0) > 0;
  const unsupported = audit?.unsupported ?? [];
  const auditMissing = !audit;
  const floor = contradiction ? "blocked" : unsupported.length || analysis?.regulatory || auditMissing ? "verify" : "ready";
  const status = ORDER[floor] > ORDER[modelStatus] ? floor : modelStatus;
  let toClarify = adv?.toClarify ?? [];
  const flagged = unsupported.map((u) => `Confirmer ou retirer : « ${u.quote || u.why} »`);
  toClarify = [...flagged.slice(0, 3), ...toClarify].slice(0, 4);
  if (analysis?.regulatory && !toClarify.some((x) => /actualit|statut|à jour|date/i.test(x))) toClarify = [...toClarify.slice(0, 3), ACTUALITY_LINE];
  let issue = adv?.issue ?? "";
  if (status !== "ready" && !issue) {
    issue = contradiction ? `Informations contradictoires : ${analysis.contradictions.join(" / ")}`
      : unsupported.length ? `Auto-contrôle du modèle (non indépendant) : ${unsupported.length} affirmation(s) du texte non étayée(s) par le brief.`
      : auditMissing ? "Auto-contrôle du modèle indisponible : texte non audité." : "À vérifier avant publication.";
  } else if (status !== "ready" && unsupported.length && !/auto-contr/i.test(issue)) issue = `${issue} (Auto-contrôle du modèle, non indépendant : ${unsupported.length} affirmation(s) non étayée(s).)`;
  let recommendation = adv?.recommendation ?? "";
  const reassuring = status !== "ready" && (isReassuring(recommendation) || isReassuring(issue));
  if (status !== "ready" && (!recommendation || reassuring)) recommendation = status === "blocked" ? "Ne publiez pas en l'état : clarifiez d'abord les points ci-dessus." : "Confirmez ou retirez les passages signalés, puis vérifiez les points ci-dessus avant de publier.";
  return { advisory: { status, issue, toClarify, recommendation }, analysis, audit, guard: { raised: status !== modelStatus, from: modelStatus, reassuringReplaced: reassuring, auditMissing } };
}

// Bloc de règles injecté dans les prompts de génération.
// La longueur visée respecte toujours la longueur maximale choisie par l'utilisateur.
// Moteur B (EDITORIAL_ENGINE=B) : `factBoundary` remplace le garde-fou anti-invention par la frontière factuelle et retire la pression à fabriquer une preuve.
// Sans option, le texte produit est strictement celui du moteur A.
// `factBoundary: "B2"` : version B2 (rôle de l'auteur, interdits étendus, réglementaire) ; `"B2b"` : B2 condensée avec « inconnu contraignant ».
export function writingRulesPrompt(maxChars, { factBoundary = false } = {}) {
  const upper = Math.min(RULES.lengthMax, Number(maxChars) || RULES.lengthMax);
  const lower = Math.min(RULES.lengthMin, upper);
  const length =
    upper > lower
      ? `environ ${lower} à ${upper} caractères, sans remplir pour atteindre un chiffre`
      : `${upper} caractères au maximum`;
  return `Règles d'écriture LinkedIn — structure le post en PYRAMIDE INVERSÉE : l'idée essentielle d'abord, le développement ensuite, le secondaire à la fin. Pas de formule plaquée : chaque post doit avoir l'air écrit pour SON sujet, pas rempli à partir d'un moule.
- ACCROCHE (1re ligne, ${RULES.hookMax} caractères maximum — c'est la SEULE ligne visible avant « voir plus ») : elle doit porter à elle seule l'idée centrale du post, pas juste l'annoncer. Un lecteur qui ne lit qu'elle doit déjà avoir compris le message. Une question, un chiffre ou un « : » peuvent l'aider à percuter, mais seulement si ça sert le sens — pas une clause obligatoire.
- CORPS : développe cette idée (${factBoundary ? "le pourquoi, le raisonnement, ce que cela change pour la cible ; un exemple concret seulement s'il figure dans les informations fournies, sinon un cas hypothétique annoncé comme tel" : "le pourquoi, une preuve, un exemple concret"}) puis termine par ce qui compte le moins pour la comprendre. Phrases courtes, un paragraphe = une idée, une ligne vide entre les paragraphes.
- LONGUEUR : ${length}.
- FIN : si une question ou un appel à l'action viennent naturellement, très bien ; sinon le post peut se conclure sur sa propre idée, sans formule ajoutée pour la forme.
- ÉMOJIS : ${RULES.emojisMax} maximum, seulement s'ils servent la lecture. Zéro émoji est un choix tout aussi valable.
- HASHTAGS : ${RULES.hashtagsMax} maximum si pertinents, tout à la fin. Aucun n'est requis.

PRIORITÉ : si les consignes de style de l'auteur, ses éléments de langage, sa ligne éditoriale ou ses exemples (indiqués plus haut) contredisent l'une de ces règles (émojis, hashtags, longueur, appel à l'action, ton, tutoiement ou vouvoiement), c'est l'auteur qui a raison : applique ses consignes. La longueur maximale stricte reste une limite absolue.

${factBoundary === "B2b" ? FACT_BOUNDARY_B2B : factBoundary === "B2" ? FACT_BOUNDARY_B2 : factBoundary ? FACT_BOUNDARY_INSTRUCTION : ANTI_INVENTION_INSTRUCTION}`;
}

// --- Explication de la forme du post ("Pourquoi ce post ?") ---

export const WHY_KEYS = ["hook", "structure", "cta", "hashtags"];

export const WHY_JSON_FORMAT = `"why": {"hook": "...", "structure": "...", "cta": "...", "hashtags": "..."}`;

export const WHY_INSTRUCTION = `Le champ "why" explique tes choix d'écriture pour CE post : une phrase courte (25 mots maximum) par clé, concrète (elle décrit ce que fait réellement le post), sans généralités.
- hook : pourquoi cette première ligne porte à elle seule l'idée du post.
- structure : pourquoi cet enchaînement (l'essentiel d'abord, les détails ensuite).
- cta : pourquoi cette fin (question, appel à l'action, ou simple conclusion si tu n'en as pas forcé une).
- hashtags : pourquoi ces hashtags, ou pourquoi tu n'en as pas mis.
Ne cite jamais de nombre de caractères, de paragraphes, d'émojis ou de hashtags : ces chiffres sont affichés séparément à côté de ton explication.`;

// Nettoie l'objet "why" renvoyé par le modèle. `forText` mémorise le texte auquel
// l'explication se rapporte, pour détecter qu'elle est périmée après une modification.
export function cleanWhy(why, forText) {
  if (!why || typeof why !== "object") return null;
  const out = {};
  for (const k of WHY_KEYS) {
    if (typeof why[k] === "string" && why[k].trim()) out[k] = why[k].trim().slice(0, 300);
  }
  return Object.keys(out).length ? { ...out, forText } : null;
}

// Éléments réels du post (pas ceux déclarés par le modèle) affichés à côté des explications.
export function postAnatomy(text = "") {
  const t = (text || "").trim();
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const isHashtagLine = (l) => /^(#[\p{L}0-9_]+\s*)+$/u.test(l);
  const hook = lines[0] || "";
  const body = lines.filter((l) => !isHashtagLine(l));
  const closing = body.length > 1 ? body[body.length - 1] : "";
  return {
    hook,
    chars: t.length,
    paragraphs: t ? t.split(/\n\s*\n/).length : 0,
    closing,
    hashtags: t.match(/#[\p{L}0-9_]+/gu) || [],
  };
}
