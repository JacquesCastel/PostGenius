// Tests de CARACTÉRISATION du coach (lib/coach.js + lib/coachData.js) : ils figent le comportement d'AVANT la phase 0 de l'intelligence
// de performance, pour que toute modification soit visible. Les tests marqués « CARACTÉRISATION T1 » décrivent un défaut connu
// (mélange de maturités J+1 / J+7) : ils devront être remplacés, volontairement, par la correction.
// Lancer : node --test scripts/coach.test.mjs (aucune base : la couche base est simulée)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { analyze, MIN_MEASURED, MIN_GROUP } from "../lib/coach.js";

const mk = (i, day, hour, imp, extra = {}) => ({
  id: `p${i}`, publishedAt: `${day}T${hour}:00:00Z`, target: "person", impressions: imp,
  likes: Math.round(imp / 50), comments: Math.round(imp / 200), shares: 0, text: `Texte ${i}`, type: "simple", ...extra,
});
// 6 mardis tôt (≈ 2 000 impressions) et 6 jeudis l'après-midi (≈ 500) : octobre-novembre 2026
const TUE = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"];
const THU = ["2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05", "2026-11-12"];
const tuesdays = () => TUE.map((d, i) => mk(i, d, "06", 2000 + i * 10));
const thursdays = () => THU.map((d, i) => mk(10 + i, d, "15", 500 + i * 10));
const summary = (r) => r.insights.map((i) => `${i.dimension}:${i.key}:${i.direction}:${i.n}:${i.confidence}`);

test("constantes : seuils du coach inchangés", () => {
  assert.equal(MIN_MEASURED, 8);
  assert.equal(MIN_GROUP, 3);
});

test("sous le seuil : aucun conseil, nombre de posts manquants indiqué", () => {
  const r = analyze([...tuesdays(), ...thursdays()].slice(0, 7));
  assert.equal(r.measured, 7);
  assert.equal(r.needed, 1);
  assert.deepEqual(r.insights, []);
  assert.equal(r.slots, null);
});

test("posts sans impressions ou sans date : non mesurés", () => {
  const rows = [...tuesdays(), ...thursdays(), mk(99, "2026-11-12", "10", 0), { ...mk(98, "2026-11-12", "10", 700), publishedAt: null }];
  assert.equal(analyze(rows).measured, 12);
});

test("jeu de référence : mardi matin ressort, jeudi après-midi est en retrait", () => {
  const r = analyze([...tuesdays(), ...thursdays()]);
  assert.equal(r.measured, 12);
  assert.equal(r.needed, 0);
  assert.equal(r.medianImpressions, 1275);
  assert.deepEqual(summary(r), ["weekday:4:down:6:moyenne", "hour:afternoon:down:6:moyenne", "weekday:2:up:6:moyenne"]);
  const up = r.insights.find((i) => i.dimension === "weekday" && i.direction === "up");
  assert.ok(Math.abs(up.lift - 1.588) < 0.001);
  assert.equal(up.action, "slot");
  assert.ok(r.insights.length <= 3, "trois conseils au plus");
  assert.deepEqual(r.slots.days, [2]);
  assert.deepEqual(r.slots.weak, [4]);
  assert.equal(r.slots.confidence, "moyenne");
});

test("déterministe et indépendant de l'ordre des lignes", () => {
  const rows = [...tuesdays(), ...thursdays()];
  // arrondi à 9 décimales : l'ordre d'addition des flottants change le dernier chiffre (1e-17), pas le résultat
  const norm = (r) => JSON.stringify(r, (k, v) => (typeof v === "number" ? Math.round(v * 1e9) / 1e9 : v));
  const a = norm(analyze(rows));
  assert.equal(norm(analyze([...rows].reverse())), a);
  assert.equal(norm(analyze(rows)), a);
});

test("groupe au-dessous de 3 posts : jamais retenu", () => {
  // 10 posts du jeudi + 2 du mardi (très forts) : le mardi n'a que 2 posts
  const rows = [...THU, "2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24"].map((d, i) => mk(i, d, "15", 500 + i * 5));
  rows.push(mk(50, "2026-11-03", "06", 5000), mk(51, "2026-11-10", "06", 5100));
  const r = analyze(rows);
  assert.ok(!r.insights.some((i) => i.dimension === "weekday" && i.key === 2));
});

test("effet irrégulier : un groupe dont les posts ne vont pas dans le même sens est écarté", () => {
  // mardis : 3 très forts, 3 très faibles → médiane du groupe haute mais moins de 2/3 des posts au-dessus de la médiane globale
  const tue = TUE.map((d, i) => mk(i, d, "06", i < 3 ? 4000 : 100));
  const rows = [...tue, ...thursdays()];
  const r = analyze(rows);
  assert.ok(!r.insights.some((i) => i.dimension === "weekday" && i.key === 2), "mardi irrégulier non retenu");
});

test("scope « tout » : chaque post est ramené à la médiane de SA destination, puis les destinations sont mélangées", () => {
  // 6 posts de page publiés le mardi, à 20 000 impressions : ramenés à leur propre médiane (≈ 1,0), ils ne gonflent pas les chiffres bruts...
  const page = TUE.map((d, i) => mk(30 + i, d, "06", 20000 + i, { target: "urn:li:organization:1" }));
  const r = analyze([...tuesdays(), ...thursdays(), ...page]);
  assert.equal(r.measured, 18);
  assert.ok(r.insights.every((i) => i.lift < 2), "aucun écart gonflé par les 20 000 impressions de la page");
  // ... mais ils DILUENT l'effet « mardi » du profil : le conseil « le mardi marche mieux » disparaît de l'analyse mélangée.
  // Observation à retenir pour le MVP : le jour de la semaine est ici confondu avec la destination.
  assert.ok(!r.insights.some((i) => i.dimension === "weekday" && i.key === 2), "effet mardi dilué par le mélange profil + page");
  assert.deepEqual(summary(r), ["weekday:4:down:6:moyenne", "hour:afternoon:down:6:moyenne"]);
});

// --- coachData.js : choix de la mesure de chaque post (couche base simulée) ---
const SRC = fs.readFileSync(new URL("../lib/coachData.js", import.meta.url), "utf8");
async function coachWith(drafts) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coach-"));
  const f = path.join(tmp, `cd-${Math.random().toString(36).slice(2)}.mjs`);
  const coachUrl = pathToFileURL(path.resolve("lib/coach.js")).href;
  fs.writeFileSync(f, SRC.replace('import { prisma } from "./db";', "const prisma = globalThis.__P;").replace('import { analyze, MIN_MEASURED } from "./coach";', `import { analyze, MIN_MEASURED } from "${coachUrl}";`));
  globalThis.__P = {
    draft: { findMany: async () => drafts },
    context: { findMany: async () => [] },
    user: { findUnique: async () => ({ companyName: "Test", publishDays: "2,4", publishTime: "08:00" }) },
  };
  const m = await import(pathToFileURL(f).href);
  return m.coachFor("u1", { scope: "profile" });
}
const draft = (i, day, hour, perf) => ({ id: `d${i}`, publishedAt: new Date(`${day}T${hour}:00:00Z`), target: "person", text: `Texte ${i}`, type: "simple", imageUrl: null, videoUrl: null, youtubeUrl: null, mood: null, contextId: null, performance: perf });
const perf = (offsetHours, impressions) => ({ offsetHours, impressions, likes: Math.round(impressions / 50), comments: 1, shares: 0 });

test("coachFor : prend la mesure la plus tardive de chaque post (J+7 sinon J+1)", async () => {
  const drafts = [
    ...TUE.map((d, i) => draft(i, d, "06", [perf(24, 800), perf(168, 2000 + i)])),
    ...THU.map((d, i) => draft(10 + i, d, "15", [perf(24, 300), perf(168, 500 + i)])),
  ];
  const r = await coachWith(drafts);
  assert.equal(r.measured, 12);
  assert.ok(r.medianImpressions > 1000, "les J+7 (≥ 500) l'emportent sur les J+1 (≤ 800)");
  assert.equal(r.current.time, "08:00");
  assert.deepEqual(r.current.days, [2, 4]);
});

test("CARACTÉRISATION T1 : un même calcul mélange des posts à J+1 et à J+7 (défaut connu)", async () => {
  // 6 mardis mesurés à J+7 (≈ 2 000) ; 6 jeudis mesurés seulement à J+1 (≈ 500, post encore jeune)
  const drafts = [
    ...TUE.map((d, i) => draft(i, d, "06", [perf(24, 900), perf(168, 2000 + i)])),
    ...THU.map((d, i) => draft(10 + i, d, "15", [perf(24, 500 + i)])),
  ];
  const r = await coachWith(drafts);
  assert.equal(r.measured, 12, "tous les posts sont comptés, quelle que soit leur maturité");
  const down = r.insights.find((i) => i.dimension === "weekday" && i.key === 4);
  assert.ok(down && down.direction === "down", "le jeudi est jugé « moins bien » alors que ses posts sont seulement plus jeunes");
});

test("CARACTÉRISATION T2 : l'âge réel de la mesure n'est pas utilisé (étiquette seule)", async () => {
  // une mesure étiquetée J+7 mais prise à 40 jours (capturedAt) compte comme une mesure à 7 jours : le coach ignore capturedAt
  const late = { ...perf(168, 5000), capturedAt: new Date("2026-12-20T00:00:00Z") };
  const drafts = [
    ...TUE.map((d, i) => draft(i, d, "06", [i === 0 ? late : perf(168, 2000 + i)])),
    ...THU.map((d, i) => draft(10 + i, d, "15", [perf(168, 500 + i)])),
  ];
  const r = await coachWith(drafts);
  assert.equal(r.measured, 12);
  const sel = JSON.stringify(drafts[0].performance[0]);
  assert.ok(sel.includes("capturedAt"), "la donnée existe en base");
  assert.ok(!SRC.includes("capturedAt"), "mais lib/coachData.js ne la lit pas");
});
