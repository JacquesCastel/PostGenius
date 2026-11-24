// Constats de performance (lib/performanceInsights.js) : niveaux, double confirmation, un par dimension, trois au plus, limites affichées.
// Lancer : node --test scripts/performance-insights.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { deriveInsights, MAX_INSIGHTS, MIN_TREND } from "../lib/performanceInsights.js";

// Posts du profil : 12 mardis très forts (étalés) et 12 jeudis faibles ; dates croissantes
const day = (i) => new Date(Date.UTC(2026, 0, 6 + i * 7)).toISOString().slice(0, 10); // mardis consécutifs
const mk = (id, date, hour, imp, extra = {}) => ({ id, publishedAt: `${date}T${hour}:00:00Z`, target: "person", impressions: imp, likes: Math.round(imp / 50), comments: 1, shares: 0, text: `Texte ${id}`, type: "simple", ...extra });
const tuesdays = (n, imp = 2000) => Array.from({ length: n }, (_, i) => mk(`t${i}`, day(i), "06", imp + i));
const thursdays = (n, imp = 500) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2026, 0, 8 + i * 7)).toISOString().slice(0, 10); return mk(`h${i}`, d, "15", imp + i); });
const find = (r, dim, dir) => r.insights.find((i) => i.dimension === dim && i.direction === dir);

test("constat complet : niveau, effectif, période, métrique, ancienneté, confiance, limites, posts utilisés", () => {
  const r = deriveInsights([...tuesdays(8), ...thursdays(8)], { maturity: "J+7" });
  const up = r.insights.find((i) => i.direction === "up");
  assert.ok(up, "le mardi (ou le matin) ressort");
  assert.equal(up.level, "tendance");
  assert.equal(up.n, 8);
  assert.equal(up.metric, "impressions");
  assert.equal(up.maturity, "J+7");
  assert.ok(up.lift > 1.3);
  assert.equal(up.periodFrom, "2026-01-06"); assert.equal(up.periodTo, "2026-02-24");
  assert.equal(r.insights.filter((i) => i.direction === "up").length, 1, "« le mardi » et « le matin » désignent les mêmes posts : un seul constat");
  assert.ok(["faible", "moyenne", "bonne"].includes(up.confidence));
  assert.ok(up.caveats.length >= 3, "facteurs non contrôlés, ancienneté, organique");
  assert.ok(up.caveats.some((c) => /jour|heure|longueur|actualité/i.test(c)));
  assert.equal(up.draftIds.length, 8);
  assert.match(up.id, /^(weekday|hour):/);
});
test("au plus trois constats, un seul par dimension et par direction ; classés « tendance » d'abord", () => {
  const r = deriveInsights([...tuesdays(10), ...thursdays(10)], { maturity: "J+7" });
  assert.ok(r.insights.length <= MAX_INSIGHTS);
  const keys = r.insights.map((i) => `${i.dimension}:${i.direction}`);
  assert.equal(new Set(keys).size, keys.length);
  const order = r.insights.map((i) => i.level);
  assert.deepEqual(order, [...order].sort((a, b) => (a === "tendance" ? 0 : 1) - (b === "tendance" ? 0 : 1)), "tendances en premier");
});
test("« observation » sous 5 posts, « tendance » à partir de 5 avec un effet confirmé sur les deux moitiés de la période", () => {
  assert.equal(MIN_TREND, 5);
  const few = deriveInsights([...tuesdays(4), ...thursdays(8)], { maturity: "J+7" });
  assert.equal(find(few, "weekday", "up")?.level, "observation");
});
test("effet non confirmé sur les deux moitiés : jamais une « tendance »", () => {
  // 6 mardis : les 3 premiers très forts, les 3 derniers à la médiane ; le groupe ressort mais n'est pas stable dans le temps
  const t = [mk("t0", day(0), "06", 3000), mk("t1", day(1), "06", 3000), mk("t2", day(2), "06", 3000), mk("t3", day(3), "06", 1300), mk("t4", day(4), "06", 1250), mk("t5", day(5), "06", 1200)];
  const r = deriveInsights([...t, ...thursdays(8, 1250)], { maturity: "J+7" });
  const up = find(r, "weekday", "up");
  assert.ok(!up || up.level === "observation", `niveau ${up?.level}`);
});
test("aucune différence nette : aucun constat ; sous le seuil de posts : aucun constat", () => {
  const flat = Array.from({ length: 12 }, (_, i) => mk(`f${i}`, day(i), "06", 1000 + (i % 2)));
  assert.deepEqual(deriveInsights(flat, { maturity: "J+7" }).insights.filter((i) => i.dimension === "weekday"), []);
  assert.deepEqual(deriveInsights([...tuesdays(3), ...thursdays(3)], { maturity: "J+7" }).insights, []);
  assert.deepEqual(deriveInsights([], {}).insights, []);
});
test("déterministe, indépendant de l'ordre des lignes", () => {
  const rows = [...tuesdays(9), ...thursdays(9)];
  const norm = (r) => JSON.stringify(r, (k, v) => (typeof v === "number" ? Math.round(v * 1e9) / 1e9 : v));
  assert.equal(norm(deriveInsights(rows, { maturity: "J+7" })), norm(deriveInsights([...rows].reverse(), { maturity: "J+7" })));
});
test("objectif du plan de campagne : utilisé seulement si au moins la moitié des posts sont qualifiés ; sinon écarté avec la raison", () => {
  // 20 mardis matin : les posts « leads » sont forts, les posts « notoriété » faibles (seul l'objectif change)
  const all = (n) => Array.from({ length: n }, (_, i) => mk(`o${i}`, day(i), "06", i % 2 === 0 ? 2000 + i : 500 + i));
  const rows = all(20).map((r, i) => ({ ...r, objective: i % 2 === 0 ? "leads" : "notoriété" }));
  const r = deriveInsights(rows, { maturity: "J+7" });
  assert.ok(r.usedDimensions.includes("objective"));
  const obj = r.insights.find((i) => i.dimension === "objective" && i.direction === "up");
  assert.ok(obj, "l'objectif « leads » ressort");
  assert.equal(obj.key, "leads");
  assert.ok(obj.caveats.some((c) => /plan de campagne|déduit|règles/i.test(c)), "provenance rappelée");
  // seulement 6 posts qualifiés sur 20 : écarté
  const sparse = all(20).map((r, i) => ({ ...r, objective: i < 6 ? (i % 2 === 0 ? "leads" : "notoriété") : null }));
  const s = deriveInsights(sparse, { maturity: "J+7" });
  assert.ok(!s.usedDimensions.includes("objective"));
  assert.ok(!s.insights.some((i) => i.dimension === "objective"));
  assert.match(s.ignoredDimensions.find((d) => d.id === "objective").reason, /6 posts sur 20/);
});
test("un groupe « non qualifié » n'est jamais comparé", () => {
  const rows = [...tuesdays(12).map((r) => ({ ...r, objective: "leads" })), ...tuesdays(4).map((r, i) => ({ ...r, id: `x${i}`, objective: "notoriété" })), ...thursdays(10)]; // les jeudis n'ont pas d'objectif
  const r = deriveInsights(rows, { maturity: "J+7" });
  assert.ok(!r.insights.some((i) => i.dimension === "objective" && i.key == null));
});
