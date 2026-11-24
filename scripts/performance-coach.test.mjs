// Coach + constats (lib/coachData.js) : désactivé = réponse strictement identique à avant ; activé = un bloc de constats en plus, jamais d'effet sur le reste.
// Lancer : node --test scripts/performance-coach.test.mjs (base simulée)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = fs.readFileSync(new URL("../lib/coachData.js", import.meta.url), "utf8");
const FIXED_NOW = Date.parse("2026-12-20T09:00:00Z");
const H = 3600_000;
const url = (rel) => pathToFileURL(path.resolve(rel)).href;

async function coachWith(drafts, opts) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pc-")), `cd-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, SRC.replace('import { prisma } from "./db";', "const prisma = globalThis.__P;")
    .replace('from "./coach"', `from "${url("lib/coach.js")}"`).replace('from "./measures"', `from "${url("lib/measures.js")}"`)
    .replace('from "./performanceInsights"', `from "${url("lib/performanceInsights.js")}"`).replace('from "./qualification"', `from "${url("lib/qualification.js")}"`));
  const selects = [];
  globalThis.__P = {
    draft: { findMany: async (q) => { selects.push(q.select); return drafts; } },
    context: { findMany: async () => [] },
    user: { findUnique: async () => ({ companyName: "Test", publishDays: "2,4", publishTime: "08:00" }) },
  };
  const realNow = Date.now; Date.now = () => FIXED_NOW;
  try { const m = await import(pathToFileURL(f).href); const r = await m.coachFor("u1", opts); return { r, selects }; } finally { Date.now = realNow; }
}
const day = (i) => new Date(Date.UTC(2026, 9, 6 + i * 7)).toISOString().slice(0, 10);
const draft = (i, date, imp, extra = {}) => { const publishedAt = new Date(`${date}T06:00:00Z`); return { id: `d${i}`, publishedAt, target: "person", text: `Texte ${i}`, type: "simple", imageUrl: null, videoUrl: null, youtubeUrl: null, mood: null, contextId: null, performance: [{ offsetHours: 168, impressions: imp, likes: Math.round(imp / 50), comments: 1, shares: 0, capturedAt: new Date(publishedAt.getTime() + 170 * H) }], ...extra }; };
// 10 posts forts « leads » + 10 posts faibles « notoriété » (tous des mardis matin : seul l'objectif change)
const fixture = () => Array.from({ length: 20 }, (_, i) => draft(i, day(i), i % 2 === 0 ? 2000 + i : 500 + i, { campaignPost: { objective: i % 2 === 0 ? "Générer des leads" : "Notoriété de la marque" }, campaign: null, editorialReco: null }));

test("désactivé (par défaut) : aucune clé en plus, requête inchangée", async () => {
  const off = await coachWith(fixture(), { scope: "profile" });
  assert.ok(!("performanceInsights" in off.r));
  assert.ok(!("campaignPost" in off.selects[0]), "aucune lecture en plus quand la fonction est coupée");
  const offExplicit = await coachWith(fixture(), { scope: "profile", performanceInsights: false });
  assert.deepEqual(Object.keys(offExplicit.r).sort(), Object.keys(off.r).sort());
});
test("activé : un bloc de constats est ajouté, le reste de la réponse est identique à celle de la version désactivée", async () => {
  const off = await coachWith(fixture(), { scope: "profile" });
  const on = await coachWith(fixture(), { scope: "profile", performanceInsights: true });
  const { performanceInsights, ...rest } = on.r;
  assert.deepEqual(JSON.parse(JSON.stringify(rest)), JSON.parse(JSON.stringify(off.r)), "coach, notes, maturité : strictement les mêmes");
  assert.ok(performanceInsights && Array.isArray(performanceInsights.insights));
  assert.equal(performanceInsights.maturity, "J+7");
  const obj = performanceInsights.insights.find((i) => i.dimension === "objective" && i.direction === "up");
  assert.ok(obj, "l'objectif « leads » du plan de campagne ressort");
  assert.equal(obj.key, "leads"); assert.equal(obj.maturity, "J+7");
  assert.match(obj.periodFrom, /^\d{4}-\d{2}-\d{2}$/, "dates ISO même si la base renvoie des objets Date");
  assert.match(obj.periodTo, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(obj.periodFrom <= obj.periodTo);
  assert.ok(obj.caveats.length >= 3);
  assert.ok(performanceInsights.insights.length <= 3);
});
test("activé : l'objectif est lu avec sa provenance (plan, campagne, proposition) et les relations nécessaires sont demandées", async () => {
  const on = await coachWith(fixture(), { scope: "profile", performanceInsights: true });
  const sel = on.selects[0];
  assert.ok(sel.campaignPost && sel.campaign && sel.editorialReco, "relations lues seulement quand la fonction est active");
  // sans aucun objectif renseigné : dimension écartée, avec la raison
  const bare = fixture().map((d) => ({ ...d, campaignPost: null }));
  const r = (await coachWith(bare, { scope: "profile", performanceInsights: true })).r;
  assert.ok(r.performanceInsights.ignoredDimensions.some((d) => d.id === "objective"));
});
test("activé, trop peu de posts : aucun constat (jamais une conclusion sur 3 posts)", async () => {
  const few = fixture().slice(0, 5);
  const r = (await coachWith(few, { scope: "profile", performanceInsights: true })).r;
  assert.deepEqual(r.performanceInsights.insights, []);
});
test("activé : profil et page restent séparés (les constats d'une destination n'utilisent que ses posts)", async () => {
  const page = Array.from({ length: 10 }, (_, i) => draft(100 + i, day(i), 99999, { target: "urn:li:organization:1", campaignPost: null }));
  const all = [...fixture(), ...page];
  const prof = (await coachWith(all.filter((d) => d.target === "person"), { scope: "profile", performanceInsights: true })).r;
  assert.ok(prof.performanceInsights.insights.every((i) => i.draftIds.every((id) => !id.startsWith("d1") || Number(id.slice(1)) < 20)), "aucun post de page");
});
