// CARACTÉRISATION du pilote automatique éditorial (lib/editorial/autopilot.js, NON modifié) : cas nominal et risque de doublons après un échec partiel.
// Les tests marqués « risque connu » décrivent le comportement ACTUEL, qu'une correction ultérieure (validée séparément) remplacera volontairement.
// Lancer : node --test scripts/autopilot-duplicates.test.mjs (base, IA et planificateur simulés)
import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./_harness.mjs";

const USER = { id: "u1", agencyId: null, autoPublishThreshold: 50, expertise: "e", publishDays: "1,2,3,4,5", tone: "t", defaultMaxChars: 1300 };

// Une exécution du pilote automatique sur un état partagé (base en mémoire) ; chaque exécution charge une NOUVELLE instance du module
// (le verrou d'une heure est en mémoire : un redémarrage ou une autre instance le remet à zéro).
async function runOnce(state, { failRespond = false } = {}) {
  const prisma = {
    user: { updateMany: async () => ({ count: 0 }), findMany: async () => [USER] },
    draft: {
      findMany: async () => state.drafts.filter((d) => ["programmé", "à valider"].includes(d.status) && d.scheduledAt).map((d) => ({ scheduledAt: d.scheduledAt })),
      create: async ({ data }) => { const d = { id: `d${state.drafts.length + 1}`, ...data }; state.drafts.push(d); return d; },
    },
  };
  let slot = 0;
  const stubs = {
    checkAccess: async () => ({ ok: true }), checkPostQuota: async () => ({ ok: true }),
    nextPreferredSlots: () => Array.from({ length: 20 }, (_, i) => new Date(Date.UTC(2026, 11, 1 + i, 8, 30))),
    generateText: async () => { state.aiCalls++; return { text: "Un post de démonstration", inspirationUrl: null }; },
    generateRecommendations: async () => state.recos.filter((r) => r.status === "proposée").map((r) => ({ ...r })),
    respondToRecommendation: async (userId, id, { status, draftId }) => {
      if (failRespond) throw new Error("panne de base après la création du brouillon");
      const r = state.recos.find((x) => x.id === id); Object.assign(r, { status, draftId }); return r;
    },
  };
  const m = await loadModule("lib/editorial/autopilot.js", { prisma, stubs });
  return m.runEditorialAutopilot();
}
const fresh = () => ({ drafts: [], aiCalls: 0, recos: [{ id: "r1", userId: "u1", status: "proposée", topic: "Sujet X", angle: "a", hook: null, cta: null, rationale: "r", postType: "simple", pillarId: "p1", confidence: 85, priority: 70, draftId: null }] });

test("cas nominal : un brouillon programmé, la proposition passe à « planifiée » et lui est reliée", async () => {
  const s = fresh();
  const r = await runOnce(s);
  assert.equal(r.published, 1);
  assert.equal(s.drafts.length, 1);
  assert.deepEqual([s.drafts[0].status, s.drafts[0].auto, s.drafts[0].pillarId, s.drafts[0].theme], ["programmé", true, "p1", "Sujet X"]);
  assert.deepEqual([s.recos[0].status, s.recos[0].draftId], ["planifiée", "d1"]);
});

test("une proposition déjà planifiée n'est pas reprise : pas de second brouillon à l'exécution suivante", async () => {
  const s = fresh();
  await runOnce(s); await runOnce(s);
  assert.equal(s.drafts.length, 1);
});

test("risque connu : si la mise à jour de la proposition échoue APRÈS la création du brouillon, la proposition reste « proposée »…", async () => {
  const s = fresh();
  const r = await runOnce(s, { failRespond: true });
  assert.equal(r.published, 0, "l'exécution compte un échec");
  assert.equal(s.drafts.length, 1, "…mais le brouillon programmé existe");
  assert.deepEqual([s.recos[0].status, s.recos[0].draftId], ["proposée", null]);
});

test("risque connu : l'exécution suivante reprend la même proposition et crée un SECOND brouillon pour le même sujet", async () => {
  const s = fresh();
  await runOnce(s, { failRespond: true });
  await runOnce(s); // l'heure d'après, ou après un redémarrage : la proposition est toujours « proposée »
  assert.equal(s.drafts.length, 2, "deux brouillons pour une seule proposition");
  assert.equal(s.drafts[0].theme, s.drafts[1].theme);
  assert.notEqual(+s.drafts[0].scheduledAt, +s.drafts[1].scheduledAt, "sur deux créneaux différents : les deux partiraient");
  assert.equal(s.aiCalls, 2, "et l'IA est appelée deux fois");
  assert.equal(s.recos[0].draftId, "d2", "seul le second est relié ; le premier est orphelin");
});

test("risque connu : tant que l'échec dure, un brouillon de plus à chaque exécution", async () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) await runOnce(s, { failRespond: true });
  assert.equal(s.drafts.length, 3);
});
