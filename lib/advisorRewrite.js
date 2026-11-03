import { locatePassage } from "./advisorReview.js";

// Conseiller éditorial : reformulation prudente d'UN passage signalé (proposition à valider, jamais appliquée en silence).
export const REWRITE_SYSTEM = `Tu aides un auteur à rendre un passage de son post LinkedIn prudent sans en changer le sens ni la voix. Tu réponds uniquement par un objet JSON valide.`;

export function rewriteUserPrompt({ text, quote, problem }) {
  return `POST COMPLET (pour la voix et le contexte) :
<<<
${text}
>>>

PASSAGE À REFORMULER, copié du post : « ${quote} »
Pourquoi il est signalé : ${problem || "affirmation factuelle non étayée"}

Consignes :
- Réécris UNIQUEMENT ce passage. Garde la voix, la personne (je / nous), la langue, le ton et à peu près la même longueur.
- Garde la conviction et l'idée de l'auteur. Retire ou adoucis seulement l'affirmation factuelle non étayée : passe-la au conditionnel, transforme-la en principe général ou en question, ou formule-la comme une position de l'auteur (« nous pensons que… »).
- N'ajoute AUCUN fait, chiffre, nom, durée, résultat ou décision.
- Le passage reformulé ne doit PLUS affirmer le fait signalé, même autrement tourné. Si tu ne peux pas le rendre prudent sans le répéter, garde seulement ce qui est une conviction ou une idée générale, ou supprime le fait.
Réponds uniquement par : {"replacement":"…"}`;
}

// Nettoie la proposition : une seule chaîne, non vide, différente du passage, de longueur raisonnable.
export function cleanReplacement(raw, quote) {
  const m = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const r = typeof j.replacement === "string" ? j.replacement.trim() : "";
  if (!r || r === String(quote).trim()) return null;
  if (r.length > Math.max(400, String(quote).length * 2)) return null;
  return r;
}

// Applique la proposition au texte : remplace le passage (retrouvé même si les guillemets ou les espaces diffèrent) ; null s'il n'est plus présent.
export function applyReplacement(text, quote, replacement) {
  const loc = locatePassage(text, quote);
  if (!loc) return null;
  return text.slice(0, loc.start) + replacement + text.slice(loc.end);
}

// ── Plusieurs ajouts à la fois : un seul appel, une proposition par passage, chacune à valider ─────────────────────────────────
export const MAX_BATCH = 8;

export function rewriteAllUserPrompt({ text, items }) {
  return `POST COMPLET (pour la voix et le contexte) :
<<<
${text}
>>>

PASSAGES À REFORMULER, copiés du post :
${items.map((it, i) => `${i + 1}. « ${it.quote} » — signalé parce que : ${it.problem || "affirmation factuelle non étayée"}`).join("\n")}

Consignes, valables pour CHAQUE passage :
- Réécris uniquement ce passage. Garde la voix, la personne (je / nous), la langue, le ton et à peu près la même longueur.
- Garde la conviction et l'idée de l'auteur. Retire ou adoucis seulement l'affirmation factuelle non étayée : conditionnel, principe général, question, ou position de l'auteur (« nous pensons que… »).
- N'ajoute AUCUN fait, chiffre, nom, durée, résultat ou décision.
- Le passage reformulé ne doit PLUS affirmer le fait signalé, même autrement tourné. Si tu ne peux pas le rendre prudent sans le répéter, garde seulement la conviction ou l'idée générale, ou supprime le fait.
- Les reformulations doivent rester cohérentes entre elles et avec le reste du post.
Réponds uniquement par : {"items":[{"n":1,"replacement":"…"}, …]} (un élément par passage, dans l'ordre).`;
}

// Associe chaque proposition à son passage ; ignore les propositions vides, identiques ou démesurées.
export function cleanReplacements(raw, items) {
  const m = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!m) return [];
  let j; try { j = JSON.parse(m[0]); } catch { return []; }
  if (!Array.isArray(j.items)) return [];
  const out = [];
  for (const x of j.items) {
    const it = items[Number(x?.n) - 1];
    if (!it) continue;
    const r = cleanReplacement(JSON.stringify({ replacement: x?.replacement }), it.quote);
    if (r && !out.some((o) => o.quote === it.quote)) out.push({ id: it.id, quote: it.quote, replacement: r });
  }
  return out;
}

// Applique les propositions acceptées, une à une, sur le texte courant ; renvoie { text, applied, skipped }.
export function applyReplacements(text, pairs) {
  let cur = text; const applied = [], skipped = [];
  for (const p of pairs) {
    const next = applyReplacement(cur, p.quote, p.replacement);
    if (next === null) skipped.push(p.quote); else { cur = next; applied.push(p.quote); }
  }
  return { text: cur, applied, skipped };
}
