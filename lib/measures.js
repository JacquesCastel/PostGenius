// Mesures de performance d'un post : âge RÉEL de la mesure, maturité comparable, posts à relire. PUR : aucun accès base ni réseau.
//
// Pourquoi : l'étiquette d'une mesure (PostPerformance.offsetHours = 24 ou 168) est celle du palier visé, pas l'âge réel du post au moment de la lecture
// (relevé quotidien, serveur arrêté, connexion tardive…). Comparer des posts à des âges différents compare leur ancienneté, pas leur contenu.
// L'âge réel se déduit de capturedAt − publishedAt, déjà en base : l'historique est corrigé à la lecture, sans migration.

export const HOUR = 3600_000;
// Fenêtres d'âge réel (en heures) dans lesquelles une mesure est comparable. `target` : l'âge visé ; `capture` : le plus petit âge auquel on la prend.
export const WINDOWS = {
  j1: { label: "J+1", name: "1 jour", target: 24, min: 20, max: 72, capture: 24 },
  j7: { label: "J+7", name: "7 jours", target: 168, min: 144, max: 240, capture: 168 },
};
export const MIN_COMPARABLE = 8; // posts mesurés à la même maturité pour une analyse (identique à MIN_MEASURED du coach)
export const CAPTURE_HORIZON_DAYS = 12; // au-delà, un palier manqué n'est plus rattrapé (la fenêtre J+7 se ferme à 10 jours)

const ts = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

// Âge réel d'une mesure, en heures (null si la date de capture ou de publication manque)
export function measureAge(measure, publishedAt) {
  if (!measure?.capturedAt || !publishedAt) return null;
  const a = (ts(measure.capturedAt) - ts(publishedAt)) / HOUR;
  return Number.isFinite(a) ? a : null;
}

// Maturité d'une mesure d'après son âge réel : "j1", "j7" ou "out" (hors de toute fenêtre) ; null si l'âge est inconnu
export function classify(age) {
  if (age == null) return null;
  for (const k of ["j1", "j7"]) if (age >= WINDOWS[k].min && age <= WINDOWS[k].max) return k;
  return "out";
}

// La mesure d'un post à une maturité donnée : celle dont l'âge réel est dans la fenêtre ET le plus proche de l'âge visé (24 h / 168 h).
// Plusieurs mesures d'un même post ne comptent jamais pour plusieurs posts.
export function bestMeasure(measures, publishedAt, maturity) {
  const w = WINDOWS[maturity];
  let best = null, bestGap = Infinity;
  for (const m of measures ?? []) {
    const age = measureAge(m, publishedAt);
    if (age == null || age < w.min || age > w.max) continue;
    const gap = Math.abs(age - w.target);
    if (gap < bestGap) { best = { ...m, ageHours: age }; bestGap = gap; }
  }
  return best;
}

// Maturité d'une analyse : J+7 si assez de posts y sont mesurés, sinon J+1 si assez le sont, sinon la plus fournie (égalité : J+7).
// Une seule maturité par analyse : jamais de mélange.
export function chooseMaturity(posts, min = MIN_COMPARABLE) {
  const c = { j1: 0, j7: 0 };
  for (const p of posts) for (const k of ["j1", "j7"]) if (bestMeasure(p.measures, p.publishedAt, k)) c[k]++;
  const maturity = c.j7 >= min ? "j7" : c.j1 >= min ? "j1" : c.j7 >= c.j1 ? "j7" : "j1";
  return { maturity, counts: c, fallback: maturity === "j1" && c.j7 < min };
}

// Pourquoi un post publié n'entre pas dans la comparaison à la maturité choisie (null s'il y entre)
export function exclusionReason(post, maturity, now = Date.now()) {
  if (bestMeasure(post.measures, post.publishedAt, maturity)) return null;
  const w = WINDOWS[maturity];
  const age = (now - ts(post.publishedAt)) / HOUR;
  if (age < w.max) return "pending"; // trop récent : la mesure à cette maturité est encore possible
  const list = post.measures ?? [];
  if (!list.length) return "noMeasure";
  const classes = list.map((m) => classify(measureAge(m, post.publishedAt)));
  if (classes.every((c) => c === "out" || c == null)) return "outOfWindow"; // mesures prises trop tôt ou trop tard
  return "missing"; // une autre maturité existe, pas celle-ci
}

// Compte les posts de l'analyse et ceux qui en sont écartés, avec la raison
export function summarize(posts, now = Date.now(), min = MIN_COMPARABLE) {
  const { maturity, counts, fallback } = chooseMaturity(posts, min);
  const excluded = { pending: 0, missing: 0, outOfWindow: 0, noMeasure: 0 };
  let used = 0;
  for (const p of posts) {
    const r = exclusionReason(p, maturity, now);
    if (r) excluded[r]++; else used++;
  }
  return { maturity, available: counts, fallback, used, excluded };
}

const plural = (n, one, many) => (n === 1 ? one : many);

// Phrases discrètes pour l'écran du coach : pourquoi des posts sont écartés ou pourquoi un conseil n'apparaît pas
export function explain({ maturity, fallback, used, excluded, available }, { insightsCount = 0, min = MIN_COMPARABLE } = {}) {
  const w = WINDOWS[maturity];
  const notes = [];
  if (used > 0) notes.push(`Les posts sont comparés à la même ancienneté : ${w.name} après la publication.`);
  if (fallback && available.j1 >= min) notes.push(`Moins de ${min} posts ont une mesure à 7 jours : la comparaison se fait à 1 jour, plus rapide mais moins stable.`);
  const e = excluded;
  if (e.pending) notes.push(`${e.pending} ${plural(e.pending, "post est", "posts sont")} trop ${plural(e.pending, "récent", "récents")} : ${plural(e.pending, "il sera comparé", "ils seront comparés")} dès sa mesure à ${w.name}.`);
  if (e.missing) notes.push(`${e.missing} ${plural(e.missing, "post n'a", "posts n'ont")} pas de mesure à ${w.name} : ${plural(e.missing, "écarté", "écartés")} de la comparaison.`);
  if (e.outOfWindow) notes.push(`${e.outOfWindow} ${plural(e.outOfWindow, "post a", "posts ont")} une mesure prise trop tôt ou trop tard (hors de ${Math.round(w.min / 24)} à ${Math.round(w.max / 24)} jours) : ${plural(e.outOfWindow, "écarté", "écartés")}.`);
  if (e.noMeasure) notes.push(`${e.noMeasure} ${plural(e.noMeasure, "post n'a", "posts n'ont")} encore aucune mesure.`);
  if (used < min) notes.push(`Il faut ${min} posts mesurés à ${w.name} pour proposer des conseils : ${used} pour l'instant.`);
  else if (insightsCount === 0) notes.push("Aucun écart net n'apparaît pour l'instant : vos posts se valent à peu près.");
  return notes;
}

// Âge visé atteint, sans mesure prise : quel palier relire maintenant ? (24 ou 168, sinon null)
// Un palier n'est pris que dans sa fenêtre : une mesure à 200 h n'est jamais étiquetée J+1.
export function dueOffset(ageHours, have) {
  const has = have instanceof Set ? have : new Set(have ?? []);
  if (!has.has(24) && ageHours >= WINDOWS.j1.capture && ageHours <= WINDOWS.j1.max) return 24;
  if (!has.has(168) && ageHours >= WINDOWS.j7.capture && ageHours <= WINDOWS.j7.max) return 168;
  return null;
}

// Posts à relire auprès de LinkedIn : d'abord ceux dont un palier est dû (le plus urgent en premier : celui dont la fenêtre se ferme le plus tôt),
// puis les plus récents jusqu'à `max`. Même budget d'appels qu'avant : `max` posts au plus.
export function selectPostsToRead(drafts, now = Date.now(), max = 10) {
  const age = (d) => (now - ts(d.publishedAt)) / HOUR;
  const due = [];
  for (const d of drafts) {
    const off = dueOffset(age(d), (d.performance ?? []).map((p) => p.offsetHours));
    if (off == null) continue;
    const close = off === 24 ? WINDOWS.j1.max : WINDOWS.j7.max;
    due.push({ d, left: close - age(d) });
  }
  due.sort((a, b) => a.left - b.left);
  const picked = due.slice(0, max).map((x) => x.d);
  const seen = new Set(picked.map((d) => d.id));
  for (const d of [...drafts].sort((a, b) => ts(b.publishedAt) - ts(a.publishedAt))) {
    if (picked.length >= max) break;
    if (!seen.has(d.id)) { picked.push(d); seen.add(d.id); }
  }
  return picked;
}

// Choisit, pour chaque post, la mesure de la maturité commune de l'analyse (une seule maturité, la plus proche de l'âge visé).
// drafts : [{ id, publishedAt, performance: [{ capturedAt, … }] }] → { summary, items: [{ draft, measure }] } (posts sans mesure comparable absents de `items`)
export function selectComparable(drafts, now = Date.now(), min = MIN_COMPARABLE) {
  const summary = summarize(drafts.map((d) => ({ id: d.id, publishedAt: d.publishedAt, measures: d.performance })), now, min);
  const items = [];
  for (const d of drafts) {
    const measure = bestMeasure(d.performance, d.publishedAt, summary.maturity);
    if (measure) items.push({ draft: d, measure });
  }
  return { summary, items };
}
