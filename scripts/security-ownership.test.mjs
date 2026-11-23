// Sécurité : appartenance des objets (brouillon, proposition, pilier) vérifiée côté serveur, dans le périmètre du compte — lot isolé de la phase 0 et de la traçabilité.
// Refus inter-comptes et non-régression des parcours existants. Lancer : node --test scripts/security-ownership.test.mjs (base simulée)
import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, fakeReq } from "./_harness.mjs";

// --- base simulée en mémoire : deux comptes, A (le demandeur) et B (un autre client) ---
function makeDb() {
  const db = {
    pillars: [{ id: "pA", userId: "A", name: "Expertise" }, { id: "pB", userId: "B", name: "Offre" }],
    recos: [
      { id: "rA", userId: "A", status: "proposée", topic: "Sujet A", angle: "x", rationale: "r", pillarId: "pA", draftId: null },
      { id: "rA2", userId: "A", status: "générée", topic: "Sujet A2", angle: "x", rationale: "r", pillarId: "pA", draftId: "dA1" },
      { id: "rB", userId: "B", status: "proposée", topic: "Sujet B", angle: "x", rationale: "r", pillarId: "pB", draftId: null },
    ],
    drafts: [
      { id: "dA1", userId: "A", status: "brouillon", imageUrl: null, auto: false, pillarId: "pA", postId: null },
      { id: "dA2", userId: "A", status: "brouillon", imageUrl: null, auto: false, pillarId: null, postId: null },
      { id: "dB1", userId: "B", status: "brouillon", imageUrl: "orig.png", auto: false, pillarId: null, postId: null },
    ],
    events: [], writes: [],
  };
  const match = (row, where = {}) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "not" in v ? row[k] !== v.not : row[k] === v));
  const prisma = {
    editorialPillar: { findFirst: async ({ where }) => db.pillars.find((r) => match(r, where)) ?? null },
    editorialRecommendation: {
      findFirst: async ({ where }) => db.recos.find((r) => match(r, where)) ?? null,
      update: async ({ where, data }) => { const r = db.recos.find((x) => x.id === where.id); Object.assign(r, data); db.writes.push(["reco.update", where.id, data]); return { ...r }; },
      updateMany: async ({ where, data }) => { const rows = db.recos.filter((r) => match(r, where)); rows.forEach((r) => Object.assign(r, data)); db.writes.push(["reco.updateMany", where, data]); return { count: rows.length }; },
    },
    draft: {
      findFirst: async ({ where }) => db.drafts.find((r) => match(r, where)) ?? null,
      create: async ({ data }) => { const d = { id: `new${db.drafts.length}`, ...data }; db.drafts.push(d); return { ...d }; },
      update: async ({ where, data }) => { const d = db.drafts.find((x) => x.id === where.id); if (!d) throw new Error("introuvable"); Object.assign(d, data); db.writes.push(["draft.update", where.id, data]); return { ...d }; },
      updateMany: async ({ where, data }) => { const rows = db.drafts.filter((r) => match(r, where)); rows.forEach((r) => Object.assign(r, data)); db.writes.push(["draft.updateMany", where, data]); return { count: rows.length }; },
      deleteMany: async ({ where }) => { const rows = db.drafts.filter((r) => match(r, where)); db.drafts = db.drafts.filter((r) => !rows.includes(r)); rows.forEach((r) => db.recos.filter((x) => x.draftId === r.id).forEach((x) => (x.draftId = null))); return { count: rows.length }; },
    },
    context: { findFirst: async () => ({ id: "c" }) },
    moment: { findFirst: async () => null },
    activityEvent: { create: async ({ data }) => { db.events.push(data); return data; } },
    slideTemplate: { findMany: async () => [] },
  };
  return { db, prisma };
}
const ME = "A";
const baseStubs = (extra = {}) => ({
  getUserId: async () => ME,
  checkAccess: async () => ({ ok: true }), checkPostQuota: async () => ({ ok: true }), limitBody: () => ({}),
  normalizeMood: () => null, isOrgUrn: () => false, parseYouTubeId: () => null, youtubeWatchUrl: (x) => x, videoPathFromUrl: () => {},
  sanitizeMentions: () => [], parseMentions: () => [], cleanPoll: () => null, cleanSlides: () => [], findKit: async () => null,
  renderPostTemplate: async () => Buffer.from(""), saveImage: async () => ({ url: "/api/images/x.png" }),
  logActivity: async (userId, kind, meta) => { baseStubs.__events?.push({ userId, kind, meta }); },
  ...extra,
});
const draftBody = (extra = {}) => ({ type: "simple", theme: "t", expertise: "e", tone: "t", maxChars: 1300, text: "Un texte de post", ...extra });
const post = async (body, stubs = {}) => { const { db, prisma } = makeDb(); const m = await loadModule("app/api/drafts/route.js", { prisma, stubs: baseStubs(stubs) }); const res = await m.POST(fakeReq(body)); return { res, db }; };

test("POST /api/drafts : un pilier d'un autre compte est refusé, rien n'est créé", async () => {
  const { res, db } = await post(draftBody({ pillarId: "pB" }));
  assert.equal(res.status, 400);
  assert.equal(db.drafts.length, 3, "aucun brouillon créé");
});
test("POST /api/drafts : un pilier inconnu est refusé", async () => {
  assert.equal((await post(draftBody({ pillarId: "nulle-part" }))).res.status, 400);
});
test("POST /api/drafts : un pilier du compte, ou aucun pilier, reste accepté (non-régression)", async () => {
  const own = await post(draftBody({ pillarId: "pA" }));
  assert.equal(own.res.status, 200);
  assert.equal(own.db.drafts.at(-1).pillarId, "pA");
  const none = await post(draftBody());
  assert.equal(none.res.status, 200);
  assert.equal(none.db.drafts.at(-1).pillarId, null);
});
test("POST /api/drafts : sans pilier, aucune lecture de pilier (comportement historique)", async () => {
  const { prisma } = makeDb(); let reads = 0; const f = prisma.editorialPillar.findFirst; prisma.editorialPillar.findFirst = async (q) => { reads++; return f(q); };
  const m = await loadModule("app/api/drafts/route.js", { prisma, stubs: baseStubs() });
  assert.equal((await m.POST(fakeReq(draftBody()))).status, 200);
  assert.equal(reads, 0);
});

// --- PATCH /api/editorial/recommendations/[id] ---
// la route appelle lib/editorial/recommendations.js : on charge la vraie fonction avec la même base simulée
async function patch(id, body) {
  const { db, prisma } = makeDb();
  const lib = await loadModule("lib/editorial/recommendations.js", { prisma });
  const m = await loadModule("app/api/editorial/recommendations/[id]/route.js", { prisma, stubs: { getUserId: async () => ME, respondToRecommendation: lib.respondToRecommendation } });
  return { res: await m.PATCH(fakeReq(body), { params: Promise.resolve({ id }) }), db };
}
test("PATCH proposition : un brouillon d'un autre compte est refusé, la proposition n'est pas modifiée", async () => {
  const { res, db } = await patch("rA", { status: "planifiée", draftId: "dB1" });
  assert.equal(res.status, 400);
  const r = db.recos.find((x) => x.id === "rA");
  assert.equal(r.draftId, null);
  assert.equal(r.status, "proposée", "refus complet : le statut ne change pas non plus");
});
test("PATCH proposition : un brouillon inexistant est refusé", async () => {
  assert.equal((await patch("rA", { status: "planifiée", draftId: "nulle-part" })).res.status, 400);
});
test("PATCH proposition : un brouillon du compte est relié (comportement du pilote automatique inchangé)", async () => {
  const { res, db } = await patch("rA", { status: "planifiée", draftId: "dA2" });
  assert.equal(res.status, 200);
  assert.equal(db.recos.find((x) => x.id === "rA").draftId, "dA2");
  assert.equal(db.recos.find((x) => x.id === "rA").status, "planifiée");
});
test("PATCH proposition : sans draftId, comportement historique (le clic « Générer » ou « Ignorer »)", async () => {
  const { res, db } = await patch("rA", { status: "générée" });
  assert.equal(res.status, 200);
  assert.equal(db.recos.find((x) => x.id === "rA").status, "générée");
  assert.equal(db.recos.find((x) => x.id === "rA").draftId, null);
});
test("PATCH proposition : la proposition d'un autre compte reste introuvable ; un statut invalide est refusé", async () => {
  assert.equal((await patch("rB", { status: "ignorée" })).res.status, 400);
  assert.equal((await patch("rA", { status: "n'importe quoi" })).res.status, 400);
});

// --- POST /api/image/template (met à jour imageUrl d'un brouillon) ---
test("gabarit d'image : le brouillon d'un autre compte n'est jamais modifié", async () => {
  const { db, prisma } = makeDb();
  const m = await loadModule("app/api/image/template/route.js", { prisma, stubs: { getUserId: async () => ME, getContextFor: async () => null, findKit: async () => null, renderPostTemplate: async () => Buffer.from("x"), saveImage: async () => ({ url: "/api/images/new.png" }) } });
  const res = await m.POST(fakeReq({ type: "post", text: "Un texte", draftId: "dB1" }));
  assert.equal(res.status, 200, "l'image est tout de même générée pour l'appelant");
  assert.equal(db.drafts.find((d) => d.id === "dB1").imageUrl, "orig.png", "le brouillon de B est intact");
});
test("gabarit d'image : le brouillon du compte est mis à jour (non-régression)", async () => {
  const { db, prisma } = makeDb();
  const m = await loadModule("app/api/image/template/route.js", { prisma, stubs: { getUserId: async () => ME, getContextFor: async () => null, findKit: async () => null, renderPostTemplate: async () => Buffer.from("x"), saveImage: async () => ({ url: "/api/images/new.png" }) } });
  await m.POST(fakeReq({ type: "post", text: "Un texte", draftId: "dA2" }));
  assert.equal(db.drafts.find((d) => d.id === "dA2").imageUrl, "/api/images/new.png");
});

