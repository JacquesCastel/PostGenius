// Relevé quotidien des statistiques du profil (lib/linkedin/profileStats.js) : T3 — un post dont un palier est dû est relu même s'il n'est
// plus parmi les 10 derniers ; le budget d'appels LinkedIn ne change pas ; une mesure n'est étiquetée que dans sa fenêtre d'âge.
// Lancer : node --test scripts/profile-stats.test.mjs (base et LinkedIn simulés)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = fs.readFileSync(new URL("../lib/linkedin/profileStats.js", import.meta.url), "utf8");
const H = 3600_000;
const NOW = Date.parse("2026-11-20T09:00:00Z");
const url = (rel) => pathToFileURL(path.resolve(rel)).href;

async function run({ drafts, performance = {}, failFor = new Set() }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ps-"));
  const f = path.join(tmp, `ps-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, SRC
    .replace('import { prisma } from "../db";', "const prisma = globalThis.__P;")
    .replace('import { decryptToken } from "../crypto";', "const decryptToken = (t) => t;")
    .replace('from "./memberStats"', `from "${url("lib/linkedin/memberStats.js")}"`)
    .replace('from "../measures"', `from "${url("lib/measures.js")}"`));
  const created = [];
  const calls = [];
  globalThis.__P = {
    linkedInAccount: { findUnique: async () => ({ statsToken: `tok-${Math.random()}`, statsExpiresAt: null }) },
    statSnapshot: { findFirst: async () => null, upsert: async ({ create }) => ({ ...create }) },
    draft: { findMany: async (q) => (q.take ? drafts.slice().sort((a, b) => b.publishedAt - a.publishedAt).slice(0, q.take) : drafts) },
    postPerformance: {
      findMany: async ({ where }) => (performance[where.draftId] ?? []).map((o) => ({ offsetHours: o })),
      create: async ({ data }) => { created.push(data); return data; },
    },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => {
    calls.push(String(u));
    const m = String(u).match(/entity=\(share:([^)]+)\)/);
    if (m && failFor.has(decodeURIComponent(m[1]))) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ elements: [{ count: 42, dateRange: { start: { year: 2026, month: 11, day: 1 } } }] }) };
  };
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const m = await import(pathToFileURL(f).href);
    const r = await m.captureProfileStats("u1");
    return { r, calls, created, perPost: calls.filter((c) => /entity=\(share:/.test(c)) };
  } finally { globalThis.fetch = realFetch; Date.now = realNow; }
}
const post = (id, hoursAgo) => ({ id, postId: `urn:li:share:${id}`, publishedAt: new Date(NOW - hoursAgo * H) });
const urnsRead = (perPost) => new Set(perPost.map((c) => decodeURIComponent(c.match(/entity=\(share:([^)]+)\)/)[1])));

test("T3 : un post de 8 jours dont le palier J+7 est dû est relu même s'il n'est pas dans les 10 plus récents", async () => {
  const recent = Array.from({ length: 12 }, (_, i) => post(`r${i}`, 50 + i * 3)); // 12 posts de 2 à 3 jours : J+1 pris, J+7 pas encore
  const old = post("old", 8 * 24);
  const performance = Object.fromEntries(recent.map((d) => [d.id, [24]]).concat([["old", [24]]]));
  const { created, perPost } = await run({ drafts: [...recent, old], performance });
  assert.ok(urnsRead(perPost).has("urn:li:share:old"), "le post dont le palier est dû est lu");
  const rec = created.find((c) => c.draftId === "old");
  assert.ok(rec, "sa mesure à 7 jours est enregistrée");
  assert.equal(rec.offsetHours, 168);
});

test("budget d'appels inchangé : au plus 10 posts relus, 73 appels au plus pour une lecture complète", async () => {
  const drafts = Array.from({ length: 25 }, (_, i) => post(`p${i}`, 30 + i * 20));
  const { calls, perPost } = await run({ drafts, performance: {} });
  assert.ok(urnsRead(perPost).size <= 10, `${urnsRead(perPost).size} posts relus`);
  assert.ok(calls.length <= 73, `${calls.length} appels`);
});

test("une mesure n'est étiquetée que dans sa fenêtre : à 200 h, jamais « J+1 »", async () => {
  const d = post("late", 200); // 200 h : J+1 manqué (fenêtre fermée à 72 h), J+7 dû
  const { created } = await run({ drafts: [d], performance: {} });
  const rec = created.filter((c) => c.draftId === "late");
  assert.deepEqual(rec.map((c) => c.offsetHours), [168]);
});

test("un post de 100 h, sans palier dû, est relu pour l'affichage mais ne produit aucune mesure étiquetée", async () => {
  const { created, perPost } = await run({ drafts: [post("mid", 100)], performance: { mid: [24] } });
  assert.equal(urnsRead(perPost).size, 1);
  assert.equal(created.length, 0);
});

test("un post trop ancien (13 jours) sans palier : ni relu en priorité ni étiqueté", async () => {
  const { created } = await run({ drafts: [post("ancient", 13 * 24)], performance: { ancient: [24] } });
  assert.equal(created.length, 0);
});

test("mesure refusée par LinkedIn : aucune mesure enregistrée pour ce post (valeur précédente conservée à l'affichage)", async () => {
  const d = post("x", 30);
  const { created } = await run({ drafts: [d], performance: {}, failFor: new Set(["urn:li:share:x"]) });
  assert.equal(created.length, 0, "pas de mesure à 0 enregistrée");
});
