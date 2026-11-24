// Qui voit les constats de performance : interrupteur général du serveur + administrateurs + comptes autorisés (liste du serveur). Désactivé par défaut.
// Lancer : node --test scripts/performance-access.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, fakeReq } from "./_harness.mjs";

const admin = { email: "admin@exemple.fr", role: "admin" };
const user = { email: "client@exemple.fr", role: "user" };
async function lib(rowByUserId = {}) {
  const prisma = { user: { findUnique: async ({ where }) => rowByUserId[where.id] ?? null } };
  return loadModule("lib/performanceAccess.js", { prisma, stubs: { isAdminUser: (u) => u?.role === "admin" } });
}

test("désactivé par défaut : sans PERFORMANCE_INSIGHTS=1, personne (administrateur compris)", async () => {
  const m = await lib();
  for (const env of [{}, { PERFORMANCE_INSIGHTS: "" }, { PERFORMANCE_INSIGHTS: "0" }, { PERFORMANCE_INSIGHTS: "true" }, { PERFORMANCE_INSIGHTS_ACCOUNTS: "client@exemple.fr" }])
    for (const u of [admin, user]) assert.equal(m.decidePerformanceAccess({ env, user: u }), false, JSON.stringify(env));
});
test("activé : les administrateurs, et seulement les comptes de la liste (adresse, sans tenir compte de la casse ni des espaces)", async () => {
  const m = await lib();
  const env = { PERFORMANCE_INSIGHTS: "1", PERFORMANCE_INSIGHTS_ACCOUNTS: " Client@Exemple.fr , autre@exemple.fr " };
  assert.equal(m.decidePerformanceAccess({ env, user: admin }), true);
  assert.equal(m.decidePerformanceAccess({ env, user }), true);
  assert.equal(m.decidePerformanceAccess({ env, user: { email: "intrus@exemple.fr", role: "user" } }), false);
  assert.equal(m.decidePerformanceAccess({ env: { PERFORMANCE_INSIGHTS: "1" }, user }), false, "liste vide : les administrateurs seulement");
  assert.equal(m.decidePerformanceAccess({ env, user: null }), false);
  assert.equal(m.decidePerformanceAccess({ env, user: { role: "user" } }), false, "pas d'adresse");
});
test("par identifiant de compte : compte inconnu ou absent = refus", async () => {
  const m = await lib({ u1: user, a1: admin });
  const env = { PERFORMANCE_INSIGHTS: "1", PERFORMANCE_INSIGHTS_ACCOUNTS: "client@exemple.fr" };
  assert.equal(await m.performanceAccessFor("u1", env), true);
  assert.equal(await m.performanceAccessFor("a1", env), true);
  assert.equal(await m.performanceAccessFor("inconnu", env), false);
  assert.equal(await m.performanceAccessFor(null, env), false);
  assert.equal(await m.performanceAccessFor("u1", {}), false);
});

// --- la route du coach ---
async function route(allowed) {
  const calls = [];
  const m = await loadModule("app/api/stats/coach/route.js", { stubs: { getUserId: async () => "u1", logActiveOncePerDay: async () => {}, performanceAccessFor: async () => allowed, coachFor: async (uid, opts) => { calls.push(opts); return { measured: 0 }; } } });
  const res = await m.GET(fakeReq({}, { url: "http://x/api/stats/coach?scope=profile" }));
  return { res, calls };
}
test("route du coach : l'option des constats n'est passée que si le compte y a droit", async () => {
  assert.equal((await route(true)).calls[0].performanceInsights, true);
  assert.equal((await route(false)).calls[0].performanceInsights, false);
});

import fs from "node:fs";
test("écran : le bloc des constats n'apparaît que si la réponse en contient, avec niveau, effectif, période, confiance et limites", () => {
  const src = fs.readFileSync("app/app/page.js", "utf8");
  assert.ok(src.includes("d.performanceInsights && ("), "affiché seulement si présent");
  for (const id of ["dash-perf-insights", "dash-perf-insight", "dash-perf-none", "dash-perf-ignored"]) assert.ok(src.includes(id), id);
  for (const w of ["Tendance", "Observation", "confiance", "Limites", "version d&apos;essai"]) assert.ok(src.includes(w), w);
});
