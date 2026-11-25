// RÈGLES D'APPRENTISSAGE VOLONTAIREMENT INCHANGÉES (décision du 23 novembre 2026) : learning.js et stats.js restent gelés.
// Le lot du 24 novembre corrige séparément l'atomicité du pilote automatique, sans changer les signaux ni les poids appris.
// Le statut « planifiée » compte toujours comme acceptation. Les tests PostgreSQL couvrent désormais la programmation et son lien.
// Lancer : node --test scripts/learning-frozen.test.mjs (base simulée)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { loadModule } from "./_harness.mjs";

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

test("fichiers gelés : empreintes (toute modification demande une validation explicite)", () => {
  assert.equal(sha("lib/editorial/learning.js"), "0ae2dd94d4205fbc0fd5d5b81e2baf1d44431fdc4e913e63141209dd1c4c085f");
  assert.equal(sha("lib/editorial/stats.js"), "0b6f614b4c1c8a88afd5408ae97d6714c55a159e5cc87e0fbb606b6d19604921");
});

test("la traçabilité n'est branchée à aucune règle d'apprentissage", () => {
  for (const f of ["lib/editorial/learning.js", "lib/editorial/stats.js", "lib/editorial/autopilot.js", "lib/editorial/autopilotStore.js"]) assert.ok(!/recoTrace|recoStage/.test(fs.readFileSync(f, "utf8")), `${f} ne lit pas les étapes`);
});

const rows = (...list) => list.map(([status, pillarId, postType, draftId = null]) => ({ status, pillarId, postType, draftId }));
async function weights(history, capture = {}) {
  const prisma = { editorialRecommendation: { findMany: async (q) => { capture.query = q; return history; } } };
  const m = await loadModule("lib/editorial/learning.js", { prisma });
  return { m, w: await m.getPreferenceWeights("u1") };
}

test("requête historique : statuts lus, tri et fenêtre de 100", async () => {
  const cap = {};
  await weights([], cap);
  assert.deepEqual(cap.query.where, { userId: "u1", status: { in: ["générée", "planifiée", "ignorée", "rejetée"] } });
  assert.equal(cap.query.take, 100);
  assert.deepEqual(cap.query.orderBy, { createdAt: "desc" });
});

test("aucun historique : poids neutres", async () => {
  const { m, w } = await weights([]);
  assert.deepEqual(w, { pillarWeight: {}, postTypeWeight: {}, sampleSize: 0 });
  assert.equal(m.applyPreference(60, { pillarId: "p", postType: "simple" }, w), 60);
});

test("lissage de Laplace : 2 × (acceptées + 1) / (acceptées + refusées + 2)", async () => {
  const h = rows(["générée", "p1", "simple"], ["planifiée", "p1", "simple"], ["générée", "p1", "simple"], ["ignorée", "p1", "simple"], ["rejetée", "p2", "carrousel"], ["rejetée", "p2", "carrousel"]);
  const { w } = await weights(h);
  assert.ok(Math.abs(w.pillarWeight.p1 - (2 * 4) / 6) < 1e-12);
  assert.ok(Math.abs(w.pillarWeight.p2 - 2 / 4) < 1e-12);
  assert.ok(Math.abs(w.postTypeWeight.simple - (2 * 4) / 6) < 1e-12);
  assert.equal(w.sampleSize, 6);
});

test("RÈGLE GELÉE : un simple clic « générée » sans brouillon relié compte comme une acceptation, comme avant", async () => {
  const withDraft = await weights(rows(["générée", "p", "simple", "d1"], ["ignorée", "p", "simple"]));
  const clickOnly = await weights(rows(["générée", "p", "simple", null], ["ignorée", "p", "simple"]));
  assert.deepEqual(clickOnly.w, withDraft.w, "le lien vers un brouillon n'a AUCUN effet sur l'apprentissage");
  assert.ok(Math.abs(clickOnly.w.pillarWeight.p - 1) < 1e-12);
});

test("RÈGLE GELÉE : « planifiée » (pilote automatique) compte comme acceptée, avec ou sans brouillon encore relié", async () => {
  const a = await weights(rows(["planifiée", "p", "simple", null], ["rejetée", "p", "simple"]));
  const b = await weights(rows(["planifiée", "p", "simple", "d9"], ["rejetée", "p", "simple"]));
  assert.deepEqual(a.w, b.w);
});

test("application des poids : bornée à 0–100, arrondie, neutre si le pilier ou le format est inconnu", async () => {
  const { m } = await weights([]);
  const w = { pillarWeight: { p: 2 }, postTypeWeight: { simple: 2, video: 0.5 } };
  assert.equal(m.applyPreference(80, { pillarId: "p", postType: "simple" }, w), 100);
  assert.equal(m.applyPreference(50, { pillarId: "p", postType: "video" }, w), 50);
  assert.equal(m.applyPreference(33, { pillarId: "x", postType: "carrousel" }, w), 33);
  assert.equal(m.applyPreference(10, { pillarId: null, postType: "video" }, w), 5);
});
