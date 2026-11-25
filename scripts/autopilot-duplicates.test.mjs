// Orchestration du pilote : aucun accès réseau, à la base ou à LinkedIn.
// L'atomicité réelle est vérifiée par autopilot-store.postgres.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./_harness.mjs";

const USER = { id: "u1", agencyId: null, disabled: false, autoPublishThreshold: 50, expertise: "e", publishDays: "1,3", tone: "t", defaultMaxChars: 1300 };
const RECO = { id: "r1", userId: "u1", status: "proposée", topic: "Sujet X", angle: "a", rationale: "r", postType: "simple", pillarId: "p1", confidence: 85, priority: 70, draftId: null };
const SLOT = new Date("2030-12-01T08:30:00Z");

async function setup(options = {}) {
  const calls = { ai: 0, scheduled: [], resets: [], candidates: [] };
  const prisma = { user: {
    updateMany: async (query) => { calls.resets.push(query); return { count: 0 }; },
    findMany: async (query) => { calls.candidates.push(query); return options.users ?? [USER]; },
  } };
  const stubs = {
    checkAccess: async () => ({ ok: options.access !== false }),
    checkPostQuota: async () => ({ ok: options.quota !== false }),
    generateRecommendations: async () => options.recos ?? [{ ...RECO }],
    findUnlinkedAutopilotDraft: async () => options.orphan ? { id: "ancien" } : null,
    nextFreeAutopilotSlot: async () => options.full ? null : SLOT,
    generateText: async () => { calls.ai++; if (options.aiError) throw new Error("IA indisponible"); return { text: "Un post de test", inspirationUrl: null }; },
    scheduleAutopilotDraft: async (...args) => {
      calls.scheduled.push(args);
      if (options.storeError) throw new Error("échec transactionnel");
      return options.stale ? null : { id: "d1", scheduledAt: SLOT };
    },
  };
  return { module: await loadModule("lib/editorial/autopilot.js", { prisma, stubs }), calls };
}

test("cas nominal : une génération et une seule programmation par le stockage atomique", async () => {
  const { module, calls } = await setup();
  assert.equal((await module.runEditorialAutopilot()).published, 1);
  assert.equal(calls.ai, 1);
  assert.deepEqual(calls.scheduled, [["u1", RECO, { text: "Un post de test", inspirationUrl: null }]]);
  assert.equal(calls.candidates[0].where.disabled, false);
  assert.equal(calls.candidates[0].where.agencyId, null);
  assert.deepEqual(calls.resets[0].data, { autoPublishThreshold: null });
});

test("recommandation traitée ou déjà liée : aucune génération", async () => {
  for (const reco of [{ ...RECO, status: "planifiée" }, { ...RECO, draftId: "d0" }, { ...RECO, confidence: 49 }]) {
    const { module, calls } = await setup({ recos: [reco] });
    assert.equal((await module.runEditorialAutopilot()).published, 0);
    assert.equal(calls.ai, 0);
    assert.equal(calls.scheduled.length, 0);
  }
});

test("ancien brouillon automatique sans lien : blocage avant tout appel IA", async () => {
  const { module, calls } = await setup({ orphan: true });
  assert.equal((await module.runEditorialAutopilot()).published, 0);
  assert.equal(calls.ai, 0);
  assert.equal(calls.scheduled.length, 0);
});

test("accès, quota ou absence de créneau : aucune génération", async () => {
  for (const options of [{ access: false }, { quota: false }, { full: true }, { users: [] }]) {
    const { module, calls } = await setup(options);
    assert.equal((await module.runEditorialAutopilot()).published, 0);
    assert.equal(calls.ai, 0);
    assert.equal(calls.scheduled.length, 0);
  }
});

test("recommandation devenue inéligible pendant l'IA : aucun succès annoncé", async () => {
  const { module, calls } = await setup({ stale: true });
  assert.equal((await module.runEditorialAutopilot()).published, 0);
  assert.equal(calls.ai, 1);
});

test("échec IA ou transactionnel : aucun succès annoncé", async () => {
  for (const options of [{ aiError: true }, { storeError: true }]) {
    const { module } = await setup(options);
    assert.equal((await module.runEditorialAutopilot()).published, 0);
  }
});

test("le verrou en mémoire d'une heure reste un simple frein aux appels", async () => {
  const { module, calls } = await setup();
  await module.runEditorialAutopilot();
  assert.deepEqual(await module.runEditorialAutopilot(), { skipped: true });
  assert.equal(calls.ai, 1);
  assert.ok(module.getAutopilotStatus().nextEligibleAt > module.getAutopilotStatus().lastRunAt);
});
