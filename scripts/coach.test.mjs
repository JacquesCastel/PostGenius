// Coach (lib/coach.js + lib/coachData.js). Les tests de `analyze` (début de fichier) figent le comportement d'AVANT la phase 0 : ils n'ont pas changé.
// Les tests de `coachFor` (fin de fichier) décrivent le comportement corrigé (T1 : une seule maturité ; T2 : âge réel ; profil et page séparés) ;
// ils ont remplacé, volontairement, trois tests de caractérisation des défauts d'origine (voir lib/measures.js et le journal de la phase 0).
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

// --- coachData.js : une maturité par analyse, âge réel, profil et page séparés (couche base simulée) ---
const SRC = fs.readFileSync(new URL("../lib/coachData.js", import.meta.url), "utf8");
const FIXED_NOW = Date.parse("2026-12-20T09:00:00Z");
async function coachWith(drafts, opts = { scope: "profile" }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coach-"));
  const f = path.join(tmp, `cd-${Math.random().toString(36).slice(2)}.mjs`);
  const url = (rel) => pathToFileURL(path.resolve(rel)).href;
  fs.writeFileSync(f, SRC.replace('import { prisma } from "./db";', "const prisma = globalThis.__P;")
    .replace('from "./coach"', `from "${url("lib/coach.js")}"`).replace('from "./measures"', `from "${url("lib/measures.js")}"`));
  let seenWhere = null;
  globalThis.__P = {
    draft: { findMany: async (q) => { seenWhere = q.where; return drafts.filter((d) => (q.where.target === "person" ? d.target === "person" : d.target === q.where.target)); } },
    context: { findMany: async () => [] },
    user: { findUnique: async () => ({ companyName: "Test", publishDays: "2,4", publishTime: "08:00" }) },
  };
  const realNow = Date.now; Date.now = () => FIXED_NOW;
  try { const m = await import(pathToFileURL(f).href); const r = await m.coachFor("u1", opts); r.__where = seenWhere; return r; } finally { Date.now = realNow; }
}
const H = 3600_000;
const draft = (i, day, hour, perf, target = "person") => {
  const publishedAt = new Date(`${day}T${hour}:00:00Z`);
  return { id: `d${i}`, publishedAt, target, text: `Texte ${i}`, type: "simple", imageUrl: null, videoUrl: null, youtubeUrl: null, mood: null, contextId: null,
    performance: perf.map(([offsetHours, impressions, ageH]) => ({ offsetHours, impressions, likes: Math.round(impressions / 50), comments: 1, shares: 0, capturedAt: new Date(publishedAt.getTime() + ageH * H) })) };
};

test("coachFor : prend la mesure de chaque post à la maturité de l'analyse (J+7 si assez de posts), la plus proche de 168 h", async () => {
  const drafts = [
    ...TUE.map((d, i) => draft(i, d, "06", [[24, 800, 26], [168, 2000 + i, 170]])),
    ...THU.map((d, i) => draft(10 + i, d, "15", [[24, 300, 26], [168, 500 + i, 170]])),
  ];
  const r = await coachWith(drafts);
  assert.equal(r.maturity, "J+7");
  assert.equal(r.maturityFallback, false);
  assert.equal(r.measured, 12);
  assert.ok(r.medianImpressions > 1000, "les mesures à 7 jours (≥ 500) l'emportent sur celles à 1 jour (≤ 800)");
  assert.equal(r.current.time, "08:00");
  assert.deepEqual(r.current.days, [2, 4]);
  assert.deepEqual(r.excluded, { pending: 0, missing: 0, outOfWindow: 0, noMeasure: 0 });
});

test("T1 corrigé : plus de mélange J+1 / J+7 — 6 posts à 7 jours seulement ⇒ repli à 1 jour pour TOUS les posts", async () => {
  // les mardis ont une mesure à 7 jours (≈ 2 000) ; les jeudis, encore jeunes, seulement à 1 jour (≈ 500) : avant, le jeudi paraissait « moins bien »
  const drafts = [
    ...TUE.map((d, i) => draft(i, d, "06", [[24, 900, 26], [168, 2000 + i, 170]])),
    ...THU.map((d, i) => draft(10 + i, d, "15", [[24, 500 + i, 26]])),
  ];
  const r = await coachWith(drafts);
  assert.equal(r.maturity, "J+1", "seulement 6 posts mesurés à 7 jours (< 8)");
  assert.equal(r.maturityFallback, true);
  assert.equal(r.measured, 12, "les 12 posts sont comparés à la MÊME ancienneté (1 jour)");
  // à 1 jour, le mardi (900) reste devant le jeudi (≈ 500) : c'est une vraie comparaison, pas un artefact d'âge
  assert.ok(r.notes.some((n) => n.includes("la comparaison se fait à 1 jour")));
});

test("T1 corrigé : un groupe plus jeune n'est plus jugé « moins bien » à cause de son âge", async () => {
  // MÊME contenu, mais les jeudis n'ont que leur mesure à 1 jour (500) alors que les mardis ont 7 jours (2 000) : seul l'âge diffère
  const tue = TUE.map((d, i) => draft(i, d, "06", [[24, 500 + i, 26], [168, 2000 + i, 170]]));
  const thu = THU.map((d, i) => draft(10 + i, d, "15", [[24, 500 + i, 26]]));
  const r = await coachWith([...tue, ...thu]);
  assert.equal(r.maturity, "J+1");
  assert.ok(!r.insights.some((i) => i.dimension === "weekday"), "à ancienneté égale, mardi et jeudi se valent : aucun conseil artificiel");
});

test("T2 corrigé : une mesure étiquetée J+7 prise à 40 jours est écartée de la comparaison, et expliquée", async () => {
  const drafts = [
    ...TUE.map((d, i) => draft(i, d, "06", [[168, i === 0 ? 5000 : 2000 + i, i === 0 ? 960 : 170]])),
    ...THU.map((d, i) => draft(10 + i, d, "15", [[168, 500 + i, 170]])),
  ];
  const r = await coachWith(drafts);
  assert.equal(r.measured, 11, "la mesure à 40 jours n'entre pas dans la médiane");
  assert.equal(r.excluded.outOfWindow, 1);
  assert.ok(r.notes.some((n) => n.startsWith("1 post a une mesure prise trop tôt ou trop tard (hors de 6 à 10 jours)")));
});

test("posts trop récents, mesure manquante, aucune mesure : comptés et expliqués", async () => {
  const eight = TUE.concat(THU).slice(0, 8).map((d, i) => draft(i, d, "06", [[168, 1000 + i, 170]]));
  const young = draft(40, "2026-12-18", "06", [[24, 300, 26]]); // 2 jours avant « maintenant »
  const missing = draft(41, "2026-11-01", "06", [[24, 300, 26]]); // ancien, sans mesure à 7 jours
  const none = draft(42, "2026-11-02", "06", []);
  const r = await coachWith([...eight, young, missing, none]);
  assert.deepEqual(r.excluded, { pending: 1, missing: 1, outOfWindow: 0, noMeasure: 1 });
  assert.equal(r.measured, 8);
  assert.ok(r.notes.some((n) => n.startsWith("1 post est trop récent")));
});

test("sous le seuil : la raison est donnée (aucun conseil, mais on dit pourquoi)", async () => {
  const r = await coachWith(TUE.slice(0, 5).map((d, i) => draft(i, d, "06", [[168, 1000 + i, 170]])));
  assert.equal(r.needed, 3);
  assert.deepEqual(r.insights, []);
  assert.ok(r.notes.includes("Il faut 8 posts mesurés à 7 jours pour proposer des conseils : 5 pour l'instant."));
});

test("profil et page ne sont jamais mélangés : chaque destination est analysée à part", async () => {
  const profil = [...TUE.map((d, i) => draft(i, d, "06", [[168, 2000 + i, 170]])), ...THU.map((d, i) => draft(10 + i, d, "15", [[168, 500 + i, 170]]))];
  const page = TUE.map((d, i) => draft(30 + i, d, "06", [[168, 20000 + i, 170]], "urn:li:organization:1"));
  const all = [...profil, ...page];
  const p = await coachWith(all, { scope: "profile" });
  assert.equal(p.measured, 12, "le profil seul : les 6 posts de page ne sont pas comptés");
  assert.deepEqual(p.__where.target, "person");
  assert.ok(p.insights.some((i) => i.dimension === "weekday" && i.key === 2 && i.direction === "up"), "l'effet « mardi » du profil n'est plus dilué par la page");
  const g = await coachWith(all, { scope: "page", org: "urn:li:organization:1" });
  assert.equal(g.measured, 6);
  assert.equal(g.destination, "urn:li:organization:1");
  const a = await coachWith(all, { scope: "all" });
  assert.equal(a.measured, 12, "« all » (créneaux du planning) = le profil, jamais profil + page");
  assert.equal(a.destination, "person");
});

test("compatibilité : les champs historiques de la réponse sont conservés", async () => {
  const r = await coachWith(TUE.concat(THU).map((d, i) => draft(i, d, "06", [[168, 1000 + i * 100, 170]])));
  for (const k of ["scope", "minMeasured", "measured", "needed", "insights", "slots", "medianImpressions", "current", "detail"]) assert.ok(k in r, `champ ${k}`);
  for (const k of ["maturity", "maturityFallback", "available", "excluded", "notes", "destination"]) assert.ok(k in r, `champ ajouté ${k}`);
});
