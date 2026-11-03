// Conseiller éditorial : état de la relecture d'un post (pur, utilisable côté client comme côté serveur).
//
// Principes :
//  - la vérification est un avis, jamais une preuve : « confirmer » signifie « je dispose des éléments », sans source indépendante ;
//  - le texte n'est jamais modifié ici ; si le texte change, le résultat précédent est caduc ;
//  - les décisions de l'utilisateur sont conservées tant que le passage concerné est présent dans le texte.

export const DECISIONS = ["open", "confirmed", "ignored", "edited"];

// Empreinte courte du texte (FNV-1a 32 bits) : sert à savoir si le texte a changé depuis la vérification.
export function hashText(text) {
  let h = 0x811c9dc5;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

// Normalise pour comparer des passages malgré les guillemets, la casse et les espaces.
const norm = (s) => String(s ?? "").toLowerCase().replace(/[«»"“”'’]/g, "").replace(/\s+/g, " ").trim();

// Retrouve un passage cité dans le texte : { start, end } en indices du texte d'origine, ou null.
export function locatePassage(text, quote) {
  const t = String(text ?? ""), q = String(quote ?? "").trim();
  if (!q) return null;
  const i = t.indexOf(q);
  if (i >= 0) return { start: i, end: i + q.length };
  // recherche normalisée avec correspondance des indices
  let nt = "", map = [];
  for (let k = 0; k < t.length; k++) {
    const c = t[k].toLowerCase();
    if (/[«»"“”'’]/.test(c)) continue;
    if (/\s/.test(c)) { if (nt.endsWith(" ") || nt === "") continue; nt += " "; map.push(k); continue; }
    nt += c; map.push(k);
  }
  const nq = norm(q);
  if (!nq) return null;
  const j = nt.indexOf(nq);
  if (j < 0) return null;
  return { start: map[j], end: map[j + nq.length - 1] + 1 };
}

export const alertId = (quote) => `a${hashText(norm(quote))}`;

export const idleReview = () => ({ status: "idle", alerts: [], interpretations: [], established: [], textHash: null, verifiedAt: null, error: null });

export const startReview = (prev) => ({ ...(prev ?? idleReview()), status: "running", error: null });

// Échec de la vérification : le texte et les décisions précédentes sont conservés ; l'utilisateur peut relancer.
export const failReview = (prev, message) => ({ ...(prev ?? idleReview()), status: "error", error: String(message || "La vérification a échoué. Votre texte est conservé : vous pouvez réessayer.") });

// Résultat reçu de /api/advisor/verify. Les décisions déjà prises sur un passage identique sont conservées.
// Deux passages désignent la même affirmation s'ils sont identiques ou si l'un contient l'autre (le vérificateur peut citer un passage plus court ou plus long).
const sameSpan = (a, b) => { const x = norm(a), y = norm(b); return x === y || (x.length > 12 && y.length > 12 && (x.includes(y) || y.includes(x))); };

export function applyVerification(prev, text, result) {
  const before = new Map((prev?.alerts ?? []).map((a) => [a.id, a]));
  const decided = (prev?.alerts ?? []).filter((o) => o.decision === "confirmed" || o.decision === "ignored");
  const alerts = (result?.alerts ?? []).map((a) => {
    // décision conservée : même identifiant, ou passage qui recouvre un passage déjà confirmé / ignoré
    const old = before.get(a.id);
    const kept = old && (old.decision === "confirmed" || old.decision === "ignored") ? old : decided.find((o) => sameSpan(o.quote, a.quote));
    const present = locatePassage(text, a.quote) !== null;
    return { ...a, found: present, decision: kept && kept.decision !== "open" ? kept.decision : "open" };
  });
  return { status: "done", alerts, interpretations: result?.interpretations ?? [], established: result?.established ?? [], textHash: hashText(text), verifiedAt: result?.verifiedAt ?? Date.now(), error: null, meta: result?.meta ?? null };
}

export function decide(review, id, decision) {
  if (!DECISIONS.includes(decision)) return review;
  return { ...review, alerts: review.alerts.map((a) => (a.id === id ? { ...a, decision } : a)) };
}

// À appeler quand le texte change (ou revient à une version précédente).
export function syncWithText(review, text) {
  if (!review || (review.status !== "done" && review.status !== "stale")) return review;
  const same = hashText(text) === review.textHash;
  if (same) return review.status === "done" ? review : { ...review, status: "done" };
  const alerts = review.alerts.map((a) => (a.decision === "open" && locatePassage(text, a.quote) === null ? { ...a, decision: "edited" } : a));
  return { ...review, status: "stale", alerts };
}

export const openCount = (review) => (review?.alerts ?? []).filter((a) => a.decision === "open").length;

// États globaux simples. Aucune formule de fiabilité garantie.
export function reviewLabel(review) {
  const st = review?.status ?? "idle";
  if (st === "running") return { code: "running", label: "Vérification en cours" };
  if (st === "error") return { code: "error", label: "Vérification impossible" };
  if (st === "stale") return { code: "stale", label: "Texte modifié : à revérifier" };
  if (st === "done") return openCount(review) > 0 ? { code: "todo", label: "Points à examiner" } : { code: "finished", label: "Relecture terminée" };
  return { code: "idle", label: "Non vérifié" };
}

// ── Persistance locale (navigateur) : décisions retrouvées à la réouverture du même texte ─────────────────────────────────────
const KEY = "lp_review_v1";
const MAX_ENTRIES = 20;

export function loadReview(storage, text) {
  try {
    const all = JSON.parse(storage?.getItem(KEY) || "{}");
    const r = all[hashText(text)];
    return r && r.status === "done" ? r : null;
  } catch { return null; }
}

export function saveReview(storage, review) {
  try {
    if (!storage || !review || review.status !== "done" || !review.textHash) return;
    const all = JSON.parse(storage.getItem(KEY) || "{}");
    all[review.textHash] = { ...review, meta: undefined };
    const keys = Object.keys(all).sort((a, b) => (all[b].verifiedAt ?? 0) - (all[a].verifiedAt ?? 0));
    for (const k of keys.slice(MAX_ENTRIES)) delete all[k];
    storage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

// ── Lecture du post par origine ────────────────────────────────────────────────────────────────────────────────────────────
// Découpe le texte en segments : « added » (ajout du rédacteur à valider ou à confirmer), « fact » (établi par le brief),
// « view » (conviction ou interprétation), « plain » (non classé). Les ajouts l'emportent en cas de chevauchement.
export function buildSegments(text, { alerts = [], established = [], interpretations = [] } = {}) {
  const t = String(text ?? "");
  const marks = [];
  const add = (quote, kind, id, priority) => { const loc = locatePassage(t, quote); if (loc) marks.push({ ...loc, kind, id, priority }); };
  for (const a of alerts) if (a.decision !== "edited") add(a.quote, "added", a.id, 0);
  for (const q of established) add(q, "fact", null, 1);
  for (const q of interpretations) add(q, "view", null, 2);
  marks.sort((a, b) => a.priority - b.priority || a.start - b.start);
  const kept = [];
  for (const m of marks) if (!kept.some((k) => m.start < k.end && m.end > k.start)) kept.push(m);
  kept.sort((a, b) => a.start - b.start);
  const out = []; let pos = 0;
  for (const m of kept) {
    if (m.start > pos) out.push({ text: t.slice(pos, m.start), kind: "plain" });
    out.push({ text: t.slice(m.start, m.end), kind: m.kind, id: m.id ?? undefined });
    pos = m.end;
  }
  if (pos < t.length) out.push({ text: t.slice(pos), kind: "plain" });
  return out;
}

// Retire un passage du texte (geste explicite de l'utilisateur) en soignant les espaces et lignes vides laissés.
export function removePassage(text, quote) {
  const loc = locatePassage(text, quote);
  if (!loc) return null;
  let out = text.slice(0, loc.start) + text.slice(loc.end);
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/^[ \t]+|[ \t]+$/g, "").trim();
  return out;
}
