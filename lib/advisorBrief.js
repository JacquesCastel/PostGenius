// Conseiller éditorial : analyse du brief avant la rédaction (logique pure ; l'appel au modèle est dans la route).
//
// Trois situations :
//  - ready                : la rédaction peut continuer ;
//  - needs_clarification  : une information essentielle manque (génération possible, mais le texte risquerait d'inventer) ;
//  - blocked              : contradiction factuelle centrale, qu'on ne peut pas réconcilier honnêtement sans clarification.
// Le statut est calculé ICI, à partir des problèmes relevés : le modèle ne décide pas du statut.

export const BRIEF_STATUSES = ["ready", "needs_clarification", "blocked"];
export const MAX_QUESTIONS = 3;
export const MAX_BRIEF_CHARS = 1500; // limite du sujet côté génération

// Un sujet purement thématique (idée, opinion, conseil) ne contient rien à contredire : pas d'appel au modèle.
export function needsBriefAnalysis(theme) {
  const t = String(theme ?? "").trim();
  if (t.length < 40) return false;
  const hasNumber = /\d/.test(t);
  const hasEventWording = /\b(nous avons|on a|j'ai|nous venons|vient de|viennent de|a reçu|a obtenu|a été|ont été|notre|nos|selon|indique|annonce|affirme|dit que|pourtant|mais)\b/i.test(t);
  return hasNumber || hasEventWording;
}

export const BRIEF_SYSTEM = `Tu es un conseiller éditorial. Tu lis le brief d'un post LinkedIn AVANT sa rédaction et tu signales uniquement ce qui empêcherait de l'écrire honnêtement. Tu réponds uniquement par un objet JSON valide.`;

export function briefUserPrompt(theme, expertise) {
  return `BRIEF DE L'AUTEUR :
<<<
${theme}
>>>
Qui écrit : ${expertise || "non précisé"}

Repère au plus ${MAX_QUESTIONS} problèmes, dans cet ordre de priorité :
1. "contradiction" : DEUX AFFIRMATIONS FACTUELLES du brief qui ne peuvent pas être vraies en même temps sur le même sujet et la même période (par exemple un chiffre annoncé et un témoignage qui le dément). Une opposition d'idées, une conviction, un point de vue critique ou un constat nuancé n'est PAS une contradiction.
2. "missing" : une information factuelle ESSENTIELLE qui manque, sans laquelle le post devrait inventer un fait précis (par exemple le nom du prix quand le brief annonce qu'un prix a été reçu). Une information simplement absente mais non nécessaire n'est pas un problème : ne pose pas de question secondaire (date, mise en forme, public, ton). Un sujet de réflexion, d'opinion ou de conseil sans événement à raconter n'a aucun manque.

Pour chaque problème : "kind", "question" (une seule question précise, que l'auteur peut compléter en une phrase), "why" (pourquoi c'est utile, en une phrase), "quotes" (les passages du brief concernés, copiés tels quels).
S'il n'y a aucun problème, renvoie une liste vide.
Réponds uniquement par : {"issues":[{"kind":"contradiction|missing","question":"…","why":"…","quotes":["…"]}]}`;
}

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Extrait et nettoie la réponse du modèle ; statut calculé en code.
export function parseBriefAnalysis(raw) {
  const m = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  if (!Array.isArray(j.issues)) return null;
  const issues = j.issues
    .map((x) => ({ kind: x?.kind === "contradiction" ? "contradiction" : x?.kind === "missing" ? "missing" : null, question: clip(x?.question, 280), why: clip(x?.why, 280), quotes: Array.isArray(x?.quotes) ? x.quotes.map((q) => clip(q, 240)).filter(Boolean).slice(0, 3) : [] }))
    .filter((x) => x.kind && x.question)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "contradiction" ? -1 : 1))
    .slice(0, MAX_QUESTIONS);
  return { issues, status: deriveBriefStatus(issues) };
}

export function deriveBriefStatus(issues) {
  if (issues.some((i) => i.kind === "contradiction")) return "blocked";
  if (issues.length) return "needs_clarification";
  return "ready";
}

// Ajoute les réponses de l'auteur au brief (elles deviennent des faits du brief, sans prétendre qu'une source les a vérifiées).
export function appendClarifications(theme, answers) {
  const lines = (answers ?? []).map((a) => ({ q: clip(a?.question, 280), a: clip(a?.answer, 400) })).filter((x) => x.a);
  if (!lines.length) return String(theme ?? "");
  const block = `Précisions de l'auteur :\n${lines.map((x) => `- ${x.q} → ${x.a}`).join("\n")}`.slice(0, 700);
  const base = String(theme ?? "").trim();
  // le sujet est tronqué à 1 500 caractères par la génération : on garde TOUTES les précisions et on abrège le début du brief si besoin
  return `${base.slice(0, MAX_BRIEF_CHARS - block.length - 2)}\n\n${block}`.trim();
}
