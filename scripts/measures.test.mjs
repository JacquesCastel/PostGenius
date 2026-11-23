// Mesures de performance (lib/measures.js) : âge réel, maturité comparable, exclusions expliquées, posts à relire. Lancer : node --test scripts/measures.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { measureAge, classify, bestMeasure, chooseMaturity, exclusionReason, summarize, explain, dueOffset, selectPostsToRead, HOUR, WINDOWS } from "../lib/measures.js";

const PUB = "2026-10-06T06:00:00Z";
const at = (hours, extra = {}) => ({ offsetHours: 24, capturedAt: new Date(Date.parse(PUB) + hours * HOUR), impressions: 100, ...extra });
const post = (id, hours, publishedAt = PUB) => ({ id, publishedAt, measures: hours.map((h) => at(h)) });

test("âge réel = capturedAt − publishedAt, pas l'étiquette", () => {
  assert.equal(measureAge(at(170, { offsetHours: 24 }), PUB), 170);
  assert.equal(measureAge({ offsetHours: 168 }, PUB), null);
  assert.equal(measureAge(at(10), null), null);
});

test("fenêtres : J+1 = 20–72 h, J+7 = 144–240 h, le reste est « hors fenêtre »", () => {
  assert.deepEqual([19.9, 20, 72, 72.1, 143.9, 144, 240, 240.1].map(classify), ["out", "j1", "j1", "out", "out", "j7", "j7", "out"]);
  assert.equal(classify(null), null);
  assert.equal(WINDOWS.j7.target, 168);
});

test("plusieurs mesures d'un même post : la plus proche de la cible (24 h / 168 h) est retenue", () => {
  const ms = [at(150), at(171), at(230)];
  assert.equal(Math.round(bestMeasure(ms, PUB, "j7").ageHours), 171);
  assert.equal(bestMeasure([at(30), at(25), at(60)], PUB, "j1").ageHours, 25);
  assert.equal(bestMeasure([at(30)], PUB, "j7"), null, "une mesure à 30 h n'est pas une mesure à 7 jours");
});

test("maturité : J+7 prioritaire, repli J+1, jamais de mélange", () => {
  const eight7 = Array.from({ length: 8 }, (_, i) => post(`a${i}`, [26, 170]));
  assert.equal(chooseMaturity(eight7).maturity, "j7");
  const six7 = [...Array.from({ length: 6 }, (_, i) => post(`b${i}`, [26, 170])), ...Array.from({ length: 6 }, (_, i) => post(`c${i}`, [26]))];
  const r = chooseMaturity(six7);
  assert.equal(r.maturity, "j1", "seulement 6 posts à 7 jours : repli à 1 jour pour TOUS");
  assert.equal(r.fallback, true);
  assert.deepEqual(r.counts, { j1: 12, j7: 6 });
  // sous le seuil des deux côtés : la maturité la plus fournie
  assert.equal(chooseMaturity([post("x", [170]), post("y", [26]), post("z", [28])]).maturity, "j1");
  assert.equal(chooseMaturity([post("x", [170]), post("y", [26])]).maturity, "j7", "égalité : J+7");
});

test("raisons d'exclusion : trop récent, mesure manquante, hors fenêtre, aucune mesure", () => {
  const now = Date.parse(PUB) + 400 * HOUR;
  assert.equal(exclusionReason(post("ok", [170]), "j7", now), null);
  assert.equal(exclusionReason(post("young", [26], "2026-10-21T06:00:00Z"), "j7", now), "pending", "publié il y a 4 jours : la mesure à 7 jours viendra");
  assert.equal(exclusionReason(post("miss", [26]), "j7", now), "missing", "ancien, a une mesure à 1 jour, pas à 7");
  assert.equal(exclusionReason(post("late", [960]), "j7", now), "outOfWindow", "étiquetée J+7, prise à 40 jours");
  assert.equal(exclusionReason(post("none", []), "j7", now), "noMeasure");
});

test("résumé : chaque post compte une fois, quelles que soient ses mesures", () => {
  const now = Date.parse(PUB) + 400 * HOUR;
  const posts = [post("a", [26, 170]), post("b", [26, 170]), post("c", [26]), post("d", [960]), post("e", [])];
  const s = summarize(posts, now, 2);
  assert.equal(s.maturity, "j7");
  assert.equal(s.used, 2);
  assert.deepEqual(s.excluded, { pending: 0, missing: 1, outOfWindow: 1, noMeasure: 1 });
  assert.equal(s.used + Object.values(s.excluded).reduce((a, b) => a + b, 0), posts.length);
});

test("explications : discrètes, en français, avec les nombres exacts", () => {
  const notes = explain({ maturity: "j7", fallback: false, used: 5, excluded: { pending: 3, missing: 1, outOfWindow: 2, noMeasure: 0 }, available: { j1: 9, j7: 5 } });
  assert.ok(notes.some((n) => n.startsWith("3 posts sont trop récents")));
  assert.ok(notes.some((n) => n.startsWith("1 post n'a pas de mesure à 7 jours")));
  assert.ok(notes.some((n) => n.startsWith("2 posts ont une mesure prise trop tôt ou trop tard (hors de 6 à 10 jours)")));
  assert.ok(notes.some((n) => n === "Il faut 8 posts mesurés à 7 jours pour proposer des conseils : 5 pour l'instant."));
  const fb = explain({ maturity: "j1", fallback: true, used: 10, excluded: { pending: 0, missing: 0, outOfWindow: 0, noMeasure: 0 }, available: { j1: 10, j7: 4 } }, { insightsCount: 0 });
  assert.ok(fb.some((n) => n.includes("la comparaison se fait à 1 jour")));
  assert.ok(fb.some((n) => n.startsWith("Aucun écart net")));
});

test("palier à relire : seulement dans sa fenêtre ; jamais une mesure à 200 h étiquetée J+1", () => {
  assert.equal(dueOffset(10, []), null);
  assert.equal(dueOffset(24, []), 24);
  assert.equal(dueOffset(72, []), 24);
  assert.equal(dueOffset(100, []), null);
  assert.equal(dueOffset(168, [24]), 168);
  assert.equal(dueOffset(200, []), 168, "le palier J+1 manqué n'est pas rattrapé à 200 h : on prend le J+7");
  assert.equal(dueOffset(200, [168]), null);
  assert.equal(dueOffset(241, [24]), null);
  assert.equal(dueOffset(30, [24]), null);
});

test("posts à relire : les palier dus passent d'abord, même au-delà des 10 derniers ; budget respecté", () => {
  const now = Date.parse("2026-11-20T06:00:00Z");
  const mk = (id, daysAgo, offs = [24, 168]) => ({ id, publishedAt: new Date(now - daysAgo * 24 * HOUR), performance: offs.map((o) => ({ offsetHours: o })) });
  // 12 posts récents déjà complets (≥ 24 h, tout capturé) + 1 post de 8 jours auquel il manque le J+7
  const recent = Array.from({ length: 12 }, (_, i) => mk(`r${i}`, 2 + i * 0.2, [24]));
  recent.forEach((d) => (d.performance = [{ offsetHours: 24 }]));
  const older = mk("due7", 8, [24]); // 8 jours : J+7 dû, fenêtre ouverte jusqu'à 10 jours
  const picked = selectPostsToRead([...recent, older], now, 10);
  assert.equal(picked.length, 10);
  assert.ok(picked.some((d) => d.id === "due7"), "le post dont le palier est dû est relu même s'il n'est pas dans les 10 plus récents");
  assert.equal(picked[0].id, "due7", "le plus urgent d'abord");
  assert.equal(new Set(picked.map((d) => d.id)).size, picked.length, "aucun doublon");
  assert.equal(selectPostsToRead([], now, 10).length, 0);
});

import { selectComparable } from "../lib/measures.js";
test("selectComparable : une seule maturité, la mesure la plus proche de la cible, posts sans mesure comparable absents", () => {
  const now = Date.parse(PUB) + 400 * HOUR;
  const d = (id, hours) => ({ id, publishedAt: PUB, performance: hours.map((h) => at(h, { impressions: Math.round(h) })) });
  const { summary, items } = selectComparable([d("a", [26, 150, 171]), d("b", [26, 169]), d("c", [26]), d("e", [960])], now, 2);
  assert.equal(summary.maturity, "j7");
  assert.deepEqual(items.map((x) => [x.draft.id, Math.round(x.measure.ageHours)]), [["a", 171], ["b", 169]]);
  assert.equal(summary.excluded.missing + summary.excluded.outOfWindow, 2);
});
