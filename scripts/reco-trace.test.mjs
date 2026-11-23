// Traçabilité « proposition → brouillon → publication → mesure » (lib/editorial/recoTrace.js). Lancer : node --test scripts/reco-trace.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./_harness.mjs";

const { recoStage } = await loadModule("lib/editorial/recoTrace.js", { prisma: {}, stubs: { logActivity: async () => {} } }); // pure : aucune base

test("étapes : proposée → génération demandée → brouillon créé → planifié → publié → mesuré", () => {
  assert.equal(recoStage({ reco: { status: "proposée" } }), "proposed");
  assert.equal(recoStage({ reco: { status: "générée" } }), "generation_requested", "le clic ne vaut pas brouillon");
  assert.equal(recoStage({ reco: { status: "générée" }, draft: { status: "brouillon" } }), "draft_created");
  assert.equal(recoStage({ reco: { status: "générée" }, draft: { status: "erreur" } }), "draft_created");
  assert.equal(recoStage({ reco: { status: "planifiée" }, draft: { status: "programmé" } }), "scheduled");
  assert.equal(recoStage({ reco: { status: "générée" }, draft: { status: "à valider" } }), "scheduled");
  assert.equal(recoStage({ reco: { status: "générée" }, draft: { status: "publié" } }), "published");
  assert.equal(recoStage({ reco: { status: "générée" }, draft: { status: "publié" }, measureCount: 2 }), "measured");
});
test("refus et remplacement ne dépendent pas du brouillon", () => {
  assert.equal(recoStage({ reco: { status: "ignorée" } }), "declined");
  assert.equal(recoStage({ reco: { status: "rejetée" }, draft: { status: "brouillon" } }), "declined");
  assert.equal(recoStage({ reco: { status: "remplacée" } }), "replaced");
});
test("brouillon disparu : suppression tracée, lien perdu (planifiée sans brouillon), sinon génération demandée — jamais une cause supposée", () => {
  assert.equal(recoStage({ reco: { status: "générée" }, draftDeleted: true }), "draft_deleted");
  assert.equal(recoStage({ reco: { status: "planifiée" } }), "link_lost", "supprimé ou délié : la cause n'est pas connue sans trace");
  assert.equal(recoStage({ reco: { status: "planifiée" }, draftDeleted: true }), "draft_deleted");
  assert.equal(recoStage({}), "unknown");
});

// --- lien atomique ---
async function trace(recos, drafts, { raceOnUnique = false } = {}) {
  const prisma = {
    draft: { findFirst: async ({ where }) => drafts.find((d) => d.id === where.id && d.userId === where.userId) ?? null },
    editorialRecommendation: {
      updateMany: async ({ where, data }) => {
        const rows = recos.filter((r) => r.id === where.id && r.userId === where.userId && r.draftId === where.draftId);
        if (raceOnUnique && rows.length) { const e = new Error("Unique constraint"); e.code = "P2002"; throw e; }
        rows.forEach((r) => Object.assign(r, data)); return { count: rows.length };
      },
    },
  };
  return loadModule("lib/editorial/recoTrace.js", { prisma, stubs: { logActivity: async () => {} } });
}
test("lien : seulement une proposition et un brouillon du compte, une seule fois, sans toucher statut ni date de réponse", async () => {
  const recos = [{ id: "r1", userId: "A", status: "générée", respondedAt: "t0", draftId: null }, { id: "r2", userId: "B", status: "proposée", draftId: null }];
  const drafts = [{ id: "d1", userId: "A" }, { id: "dB", userId: "B" }];
  const m = await trace(recos, drafts);
  assert.deepEqual(await m.linkRecoToDraft("A", "r1", "d1"), { linked: true, reason: null });
  assert.equal(recos[0].draftId, "d1");
  assert.equal(recos[0].status, "générée");
  assert.equal(recos[0].respondedAt, "t0");
  assert.deepEqual(await m.linkRecoToDraft("A", "r1", "d1"), { linked: false, reason: "already" }, "deuxième lien refusé");
  assert.deepEqual(await m.linkRecoToDraft("A", "r2", "d1"), { linked: false, reason: "already" }, "proposition d'un autre compte : aucun effet");
  assert.equal(recos[1].draftId, null);
  assert.deepEqual(await m.linkRecoToDraft("A", "r1", "dB"), { linked: false, reason: "draft" }, "brouillon d'un autre compte");
});
test("lien : une collision sur la contrainte d'unicité est signalée à l'appelant (qui ne bloque jamais le post)", async () => {
  const m = await trace([{ id: "r1", userId: "A", draftId: null }], [{ id: "d1", userId: "A" }], { raceOnUnique: true });
  await assert.rejects(() => m.linkRecoToDraft("A", "r1", "d1"), { code: "P2002" });
});
