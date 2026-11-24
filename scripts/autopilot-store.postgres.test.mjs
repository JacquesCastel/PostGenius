// Base JETABLE locale uniquement. Ne lit jamais DATABASE_URL ni .env.
// AUTOPILOT_TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/linkeepost_autopilot_test node --test scripts/autopilot-store.postgres.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadModule } from "./_harness.mjs";

const url = process.env.AUTOPILOT_TEST_DATABASE_URL;
if (!url) {
  test("stockage du pilote — PostgreSQL local jetable requis", { skip: "AUTOPILOT_TEST_DATABASE_URL absente" }, () => {});
} else {
  const target = new URL(url);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "Tests refusés hors localhost");
  assert.equal(target.pathname, "/linkeepost_autopilot_test", "Tests refusés dans une autre base");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  test.after(() => prisma.$disconnect());

  const slots = Array.from({ length: 20 }, (_, index) => new Date(Date.UTC(2030, 11, 1 + index, 8, 30)));
  async function fixture(t, options = {}) {
    const id = randomUUID();
    const user = await prisma.user.create({ data: { id, email: `${id}@example.test`, password: "fake-test-only", expertise: "Expertise fictive", publishDays: "1,3", autoPublishThreshold: 50, ...options } });
    t.after(() => prisma.user.delete({ where: { id } }));
    const reco = await prisma.editorialRecommendation.create({ data: { userId: id, topic: "Sujet fictif", angle: "Angle fictif", rationale: "Test isolé", confidence: 85, priority: 70, postType: "simple" } });
    return { user, reco };
  }
  async function store(client = prisma) {
    return loadModule("lib/editorial/autopilotStore.js", { prisma: client, stubs: { nextPreferredSlots: () => slots } });
  }
  const generated = { text: "Texte entièrement fictif, jamais publié.", inspirationUrl: null };
  const draftData = (user, overrides = {}) => ({ userId: user.id, type: "simple", theme: "Autre sujet", expertise: "Test", tone: "Test", maxChars: 1300, text: "Fictif", status: "programmé", scheduledAt: slots[0], ...overrides });
  function wrappedTransaction(wrap) {
    return { $transaction: (fn, options) => prisma.$transaction((tx) => fn(wrap(tx)), options) };
  }
  async function autopilot(m, ai) {
    return loadModule("lib/editorial/autopilot.js", { prisma, stubs: {
      ...m,
      checkAccess: async () => ({ ok: true }), checkPostQuota: async () => ({ ok: true }),
      generateRecommendations: (userId) => prisma.editorialRecommendation.findMany({ where: { userId, status: "proposée" } }),
      generateText: ai,
    } });
  }

  test("le brouillon programmé et son lien sont validés ensemble, une relance ne crée rien", async (t) => {
    const { user, reco } = await fixture(t);
    const m = await store();
    const draft = await m.scheduleAutopilotDraft(user.id, reco, generated);
    assert.ok(draft);
    assert.deepEqual([draft.status, draft.auto, draft.theme, +draft.scheduledAt], ["programmé", true, reco.topic, +slots[0]]);
    const saved = await prisma.editorialRecommendation.findUnique({ where: { id: reco.id } });
    assert.equal(saved.status, "planifiée");
    assert.equal(saved.draftId, draft.id);
    assert.ok(saved.respondedAt);
    assert.equal(await m.scheduleAutopilotDraft(user.id, reco, generated), null);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 1);
  });

  test("panne après création : aucun brouillon orphelin, puis une seule création à la reprise", async (t) => {
    const { user, reco } = await fixture(t);
    const broken = await store(wrappedTransaction((tx) => ({ ...tx, editorialRecommendation: { ...tx.editorialRecommendation, update: async () => { throw new Error("panne après création"); } } })));
    for (let attempt = 0; attempt < 3; attempt++) {
      await assert.rejects(broken.scheduleAutopilotDraft(user.id, reco, generated), /panne après création/);
      assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 0);
      const saved = await prisma.editorialRecommendation.findUnique({ where: { id: reco.id } });
      assert.deepEqual([saved.status, saved.draftId, saved.respondedAt], ["proposée", null, null]);
    }
    const m = await store();
    assert.ok(await m.scheduleAutopilotDraft(user.id, reco, generated));
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 1);
  });

  test("deux instances sur la même recommandation : un seul brouillon et un seul succès", async (t) => {
    const { user, reco } = await fixture(t);
    let entered = 0, release;
    const barrier = new Promise((resolve) => { release = resolve; });
    const client = wrappedTransaction((tx) => ({ ...tx, editorialRecommendation: { ...tx.editorialRecommendation, updateMany: async (args) => {
      if (++entered <= 2) {
        if (entered === 2) release();
        await barrier;
      }
      return tx.editorialRecommendation.updateMany(args);
    } } }));
    const first = await store(client);
    const second = await store(client);
    const results = await Promise.all([first.scheduleAutopilotDraft(user.id, reco, generated), second.scheduleAutopilotDraft(user.id, reco, generated)]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 1);
    assert.equal(entered, 2, "les deux transactions avaient sélectionné la même recommandation avant de la réserver");
  });

  test("deux recommandations concurrentes : des créneaux distincts après résolution du conflit", async (t) => {
    const { user, reco } = await fixture(t);
    const other = await prisma.editorialRecommendation.create({ data: { userId: user.id, topic: "Second sujet fictif", angle: "Autre angle", rationale: "Test", confidence: 90 } });
    let entered = 0, release;
    const barrier = new Promise((resolve) => { release = resolve; });
    const m = await store(wrappedTransaction((tx) => ({ ...tx, draft: { ...tx.draft, create: async (args) => {
      if (++entered <= 2) {
        if (entered === 2) release();
        await barrier;
      }
      return tx.draft.create(args);
    } } })));
    const results = await Promise.all([m.scheduleAutopilotDraft(user.id, reco, generated), m.scheduleAutopilotDraft(user.id, other, generated)]);
    assert.ok(results.every(Boolean));
    assert.notEqual(+results[0].scheduledAt, +results[1].scheduledAt);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 2);
    assert.ok(entered >= 3, "un conflit réel a imposé une nouvelle tentative");
  });

  test("un créneau occupé au-delà de 14 jours n'est pas réutilisé", async (t) => {
    const { user, reco } = await fixture(t);
    await prisma.draft.createMany({ data: slots.slice(0, 19).map((slot) => draftData(user, { scheduledAt: slot })) });
    const m = await store();
    const draft = await m.scheduleAutopilotDraft(user.id, reco, generated);
    assert.equal(+draft.scheduledAt, +slots[19]);
  });

  test("aucun créneau libre : la recommandation reste proposée et sans lien", async (t) => {
    const { user, reco } = await fixture(t);
    await prisma.draft.createMany({ data: slots.map((slot) => draftData(user, { scheduledAt: slot })) });
    const m = await store();
    assert.equal(await m.scheduleAutopilotDraft(user.id, reco, generated), null);
    const saved = await prisma.editorialRecommendation.findUnique({ where: { id: reco.id } });
    assert.deepEqual([saved.status, saved.draftId, saved.respondedAt], ["proposée", null, null]);
  });

  test("opt-in retiré, compte suspendu ou seuil augmenté pendant l'IA : aucun brouillon", async (t) => {
    for (const patch of [{ autoPublishThreshold: null }, { disabled: true }, { autoPublishThreshold: 95 }]) {
      const { user, reco } = await fixture(t);
      await prisma.user.update({ where: { id: user.id }, data: patch });
      const m = await store();
      assert.equal(await m.scheduleAutopilotDraft(user.id, reco, generated), null);
      assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 0);
    }
  });

  test("recommandation refusée ou réécrite pendant l'IA : aucune programmation périmée", async (t) => {
    for (const patch of [{ status: "rejetée" }, { topic: "Sujet modifié" }]) {
      const { user, reco } = await fixture(t);
      await prisma.editorialRecommendation.update({ where: { id: reco.id }, data: patch });
      const m = await store();
      assert.equal(await m.scheduleAutopilotDraft(user.id, reco, generated), null);
      assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 0);
    }
  });

  test("cloisonnement : une recommandation d'un autre compte ne produit aucun brouillon", async (t) => {
    const first = await fixture(t);
    const second = await fixture(t);
    const m = await store();
    assert.equal(await m.scheduleAutopilotDraft(first.user.id, second.reco, generated), null);
    assert.equal(await prisma.draft.count({ where: { userId: first.user.id } }), 0);
  });

  test("ancien orphelin : bloqué sans suppression ni rattachement déduit du thème", async (t) => {
    const { user, reco } = await fixture(t);
    const orphan = await prisma.draft.create({ data: draftData(user, { theme: reco.topic, auto: true }) });
    const m = await store();
    await assert.rejects(m.scheduleAutopilotDraft(user.id, reco, generated), /vérification manuelle/);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 1);
    assert.ok(await prisma.draft.findUnique({ where: { id: orphan.id } }));
    const saved = await prisma.editorialRecommendation.findUnique({ where: { id: reco.id } });
    assert.deepEqual([saved.status, saved.draftId], ["proposée", null]);
  });

  test("un brouillon déjà lié à une autre recommandation n'est pas pris pour un orphelin", async (t) => {
    const { user, reco } = await fixture(t);
    const draft = await prisma.draft.create({ data: draftData(user, { theme: reco.topic, auto: true }) });
    await prisma.editorialRecommendation.create({ data: { userId: user.id, topic: reco.topic, angle: "Ancien angle", rationale: "Test", status: "planifiée", draftId: draft.id } });
    const m = await store();
    assert.ok(await m.scheduleAutopilotDraft(user.id, reco, generated));
  });

  test("conflit persistant : trois tentatives au plus, aucun brouillon conservé", async (t) => {
    const { user, reco } = await fixture(t);
    let attempts = 0;
    const m = await store(wrappedTransaction((tx) => ({ ...tx, editorialRecommendation: { ...tx.editorialRecommendation, update: async () => {
      attempts++;
      throw Object.assign(new Error("conflit simulé"), { code: "P2034" });
    } } })));
    await assert.rejects(m.scheduleAutopilotDraft(user.id, reco, generated), { code: "P2034" });
    assert.equal(attempts, 3);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 0);
  });

  test("parcours complet : panne du lien, redémarrage, puis reprise unique", async (t) => {
    const { user, reco } = await fixture(t);
    let failLink = true, aiCalls = 0;
    const m = await store(wrappedTransaction((tx) => ({ ...tx, editorialRecommendation: { ...tx.editorialRecommendation, update: (args) => {
      if (failLink) throw new Error("lien indisponible");
      return tx.editorialRecommendation.update(args);
    } } })));
    const ai = async () => { aiCalls++; return generated; };
    assert.equal((await (await autopilot(m, ai)).runEditorialAutopilot()).published, 0);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 0);
    failLink = false;
    assert.equal((await (await autopilot(m, ai)).runEditorialAutopilot()).published, 1);
    assert.equal((await (await autopilot(m, ai)).runEditorialAutopilot()).published, 0);
    assert.equal(aiCalls, 2);
    const saved = await prisma.editorialRecommendation.findUnique({ where: { id: reco.id } });
    assert.equal(saved.status, "planifiée");
    assert.ok(saved.draftId);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 1);
  });

  test("un conflit transactionnel réutilise le texte, sans appeler l'IA dans la transaction", async (t) => {
    const { user } = await fixture(t);
    let conflict = true, aiCalls = 0, active = false;
    const client = { $transaction: async (fn, options) => {
      assert.equal(active, false);
      active = true;
      try {
        return await prisma.$transaction((tx) => fn({ ...tx, editorialRecommendation: { ...tx.editorialRecommendation, update: (args) => {
          if (conflict) { conflict = false; throw Object.assign(new Error("conflit"), { code: "P2034" }); }
          return tx.editorialRecommendation.update(args);
        } } }), options);
      } finally { active = false; }
    } };
    const m = await store(client);
    const run = await autopilot(m, async () => { assert.equal(active, false); aiCalls++; return generated; });
    assert.equal((await run.runEditorialAutopilot()).published, 1);
    assert.equal(aiCalls, 1);
    assert.equal(await prisma.draft.count({ where: { userId: user.id } }), 1);
  });
}
