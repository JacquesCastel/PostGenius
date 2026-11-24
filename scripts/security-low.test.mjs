// Sécurité, failles de basse gravité : noms de fichiers publics sans identifiant de compte, compte de publication vérifié, filtre de compte sur les
// modifications d'événements, médias et campagnes (défense en profondeur), images de charte limitées à celles de LinkeePost.
// Lancer : node --test scripts/security-low.test.mjs (base et disque temporaires)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadModule, fakeReq } from "./_harness.mjs";

const read = (f) => fs.readFileSync(f, "utf8");

// ---------- 1. noms de fichiers publics ----------
async function upload(route, type, bytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-"));
  process.env.IMAGE_DIR = path.join(dir, "images");
  const saved = [];
  const m = await loadModule(route, { stubs: { getUserId: async () => "cmwuser000000000000000001", getContextFor: async () => null, saveKit: async (u, c, d) => { saved.push(d); } } });
  const fd = new FormData(); fd.set("file", new File([bytes], "x", { type }));
  const res = await m.POST({ formData: async () => fd, headers: new Headers() });
  return { res, saved, dir };
}
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
for (const [name, route, key, sub] of [["logo", "app/api/brand-kit/logo/route.js", "logoUrl", "logos"], ["fond", "app/api/brand-kit/background/route.js", "backgroundUrl", "backgrounds"]]) {
  test(`${name} de charte : le nom du fichier public ne contient pas l'identifiant du compte`, async () => {
    const { res, saved, dir } = await upload(route, "image/png", PNG);
    assert.equal(res.status, 200);
    const url = saved[0][key];
    assert.ok(!url.includes("cmwuser000000000000000001"), `identifiant dans l'adresse publique : ${url}`);
    assert.match(url, new RegExp(`^/api/images/${sub}/[a-f0-9]{16}\\.png$`), "nom aléatoire de 64 bits");
    const file = url.split("/").pop();
    const onDisk = fs.readdirSync(path.join(dir, sub)).includes(file);
    assert.ok(onDisk, "le fichier existe sous ce nom");
  });
}

// ---------- 2. compte de publication ----------
function db(account) {
  const state = { drafts: [{ id: "d1", userId: "A", status: "brouillon", target: "person" }], created: [], lookups: 0 };
  const prisma = {
    linkedInAccount: { findUnique: async () => { state.lookups++; return account; } },
    context: { findFirst: async () => ({ id: "c" }) }, moment: { findFirst: async () => null }, editorialPillar: { findFirst: async () => ({ id: "p" }) },
    editorialRecommendation: { findFirst: async () => null },
    draft: {
      create: async ({ data }) => { const d = { id: "new", ...data }; state.created.push(d); return d; },
      updateMany: async ({ where, data }) => { const rows = state.drafts.filter((r) => r.id === where.id && r.userId === where.userId); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
      findFirst: async ({ where }) => state.drafts.find((r) => r.id === where.id && r.userId === where.userId) ?? null,
    },
  };
  return { prisma, state };
}
const ORG1 = "urn:li:organization:111", ORG2 = "urn:li:organization:222";
const baseStubs = (extra = {}) => ({ getUserId: async () => "A", checkAccess: async () => ({ ok: true }), checkPostQuota: async () => ({ ok: true }), limitBody: () => ({}), normalizeMood: () => null, isOrgUrn: (t) => /^urn:li:organization:\d+$/.test(String(t)), parseYouTubeId: () => null, youtubeWatchUrl: (x) => x, videoPathFromUrl: () => {}, sanitizeMentions: () => [], parseMentions: () => [], cleanPoll: () => null, cleanSlides: () => [], findKit: async () => null, parisDay: () => "2026-11-24", resolveDraftAssociations: async () => ({ pillarId: null, recoId: null }), linkRecoToDraft: async () => ({}), renderPostTemplate: async () => Buffer.alloc(0), saveImage: async () => ({ url: "/x" }), ...extra });
async function withOwnership(prisma, stubs) {
  const t = await loadModule("lib/targetOwnership.js", { prisma });
  return baseStubs({ userOwnsTarget: t.userOwnsTarget, ...stubs });
}
const body = (extra = {}) => ({ type: "simple", theme: "t", expertise: "e", tone: "t", maxChars: 1300, text: "Un texte de post", ...extra });
const postDraft = async (account, data) => { const { prisma, state } = db(account); const m = await loadModule("app/api/drafts/route.js", { prisma, stubs: await withOwnership(prisma) }); return { res: await m.POST(fakeReq(body(data))), state }; };
const patchDraft = async (account, data) => { const { prisma, state } = db(account); const m = await loadModule("app/api/drafts/[id]/route.js", { prisma, stubs: await withOwnership(prisma) }); return { res: await m.PATCH(fakeReq(data), { params: Promise.resolve({ id: "d1" }) }), state }; };
const ACC = { orgUrn: ORG1, orgAccounts: JSON.stringify([{ urn: ORG1, name: "Une" }, { urn: ORG2, name: "Deux" }]) };

test("compte de publication : une page qui n'est pas connectée au compte est refusée (création et modification)", async () => {
  const c = await postDraft(ACC, { target: "urn:li:organization:999" });
  assert.equal(c.res.status, 400); assert.equal(c.state.created.length, 0);
  const p = await patchDraft(ACC, { target: "urn:li:organization:999" });
  assert.equal(p.res.status, 400); assert.equal(p.state.drafts[0].target, "person");
  assert.equal((await postDraft(null, { target: ORG1 })).res.status, 400, "aucun compte LinkedIn connecté");
});
test("compte de publication : le profil, une page connectée (liste ou page historique) et l'absence de choix restent acceptés", async () => {
  assert.equal((await postDraft(ACC, { target: "person" })).res.status, 200);
  assert.equal((await postDraft(ACC, { target: ORG2 })).res.status, 200);
  assert.equal((await postDraft({ orgUrn: ORG1, orgAccounts: null }, { target: ORG1 })).res.status, 200, "ancienne connexion sans liste");
  const none = await postDraft(ACC, {}); assert.equal(none.res.status, 200);
  assert.equal(none.state.lookups, 0, "pas de lecture quand aucun compte n'est choisi");
  assert.equal((await patchDraft(ACC, { target: ORG1 })).res.status, 200);
  assert.equal((await patchDraft(ACC, { text: "autre texte" })).res.status, 200, "modifier autre chose n'est pas gêné");
});
test("compte de publication : la liste enregistrée mal formée ne laisse rien passer", async () => {
  assert.equal((await postDraft({ orgUrn: null, orgAccounts: "pas du json" }, { target: ORG1 })).res.status, 400);
  assert.equal((await postDraft({ orgUrn: null, orgAccounts: JSON.stringify([null, 3, { urn: 5 }]) }, { target: ORG1 })).res.status, 400);
});

// ---------- 3. filtre de compte sur les modifications (défense en profondeur) ----------
const asks = (calls, op) => calls.filter((c) => c.op === op);
test("événements : modification et suppression filtrées sur le compte, pas seulement sur l'identifiant", async () => {
  const calls = []; const ev = { id: "e1", userId: "A" };
  const prisma = { event: { findUnique: async () => ev, update: async (q) => { calls.push({ op: "update", where: q.where }); return ev; }, delete: async (q) => { calls.push({ op: "delete", where: q.where }); } } };
  const m = await loadModule("app/api/events/[id]/route.js", { prisma, stubs: { getUserId: async () => "A" } });
  await m.PATCH(fakeReq({ name: "x" }), { params: Promise.resolve({ id: "e1" }) });
  await m.DELETE(fakeReq(), { params: Promise.resolve({ id: "e1" }) });
  assert.equal(calls.length, 2);
  for (const c of calls) assert.equal(c.where.userId, "A", `${c.op} sans filtre de compte`);
  // un événement d'un autre compte reste introuvable, rien n'est modifié
  const other = { event: { findUnique: async () => ({ id: "e2", userId: "B" }), update: async () => { throw new Error("modifié !"); }, delete: async () => { throw new Error("supprimé !"); } } };
  const m2 = await loadModule("app/api/events/[id]/route.js", { prisma: other, stubs: { getUserId: async () => "A" } });
  assert.equal((await m2.PATCH(fakeReq({ name: "x" }), { params: Promise.resolve({ id: "e2" }) })).status, 404);
  assert.equal((await m2.DELETE(fakeReq(), { params: Promise.resolve({ id: "e2" }) })).status, 404);
});
test("événements LinkedIn : chaque mise à jour de l'événement est filtrée sur le compte", () => {
  const src = read("app/api/events/[id]/linkedin/route.js");
  const calls = [...src.matchAll(/prisma\.event\.update\(\{\s*where:\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(calls.length >= 3, `${calls.length} mises à jour trouvées`);
  for (const w of calls) assert.ok(/userId/.test(w), `mise à jour sans filtre de compte : { ${w.trim()} }`);
});
test("médias : modification et suppression filtrées sur le compte", async () => {
  const calls = []; const asset = { id: "m1", userId: "A", fileName: "f.png" };
  const prisma = { mediaAsset: { findUnique: async () => asset, update: async (q) => { calls.push({ op: "update", where: q.where }); return asset; }, delete: async (q) => { calls.push({ op: "delete", where: q.where }); } } };
  const m = await loadModule("app/api/media/[id]/route.js", { prisma, stubs: { getUserId: async () => "A", deleteMediaFile: async () => {} } });
  await m.PATCH(fakeReq({ category: "c" }), { params: Promise.resolve({ id: "m1" }) });
  await m.DELETE(fakeReq(), { params: Promise.resolve({ id: "m1" }) });
  assert.equal(calls.length, 2);
  for (const c of calls) assert.equal(c.where.userId, "A", `${c.op} sans filtre de compte`);
});
test("campagnes : suppression filtrée sur le compte", async () => {
  const calls = [];
  const prisma = { campaign: { findFirst: async () => ({ id: "k1" }), delete: async (q) => { calls.push(q.where); } }, draft: { deleteMany: async () => ({ count: 0 }) } };
  const m = await loadModule("app/api/campaigns/[id]/route.js", { prisma, stubs: { getUserId: async () => "A" } });
  const res = await m.DELETE(fakeReq({}, { url: "http://x/api/campaigns/k1" }), { params: Promise.resolve({ id: "k1" }) });
  assert.equal(res.status, 200);
  assert.equal(calls[0].userId, "A");
});

// ---------- 4. charte graphique : images de LinkeePost seulement ----------
test("charte graphique : une adresse d'image externe n'est jamais enregistrée ; les images de LinkeePost et l'absence de valeur restent comme avant", async () => {
  const saved = [];
  const assets = await loadModule("lib/assetUrl.js", {});
  const m = await loadModule("app/api/brand-kit/route.js", { stubs: { getUserId: async () => "A", getContextFor: async () => null, saveKit: async (u, c, d) => { saved.push(d); return d; }, findKit: async () => null, isOwnAsset: assets.isOwnAsset } });
  await m.POST(fakeReq({ logoUrl: "http://169.254.169.254/logo.png", backgroundUrl: "/api/images/backgrounds/0123456789abcdef.png", primaryColor: "#123456" }));
  assert.equal(saved[0].logoUrl, null, "adresse externe retirée");
  assert.equal(saved[0].backgroundUrl, "/api/images/backgrounds/0123456789abcdef.png");
  assert.equal(saved[0].primaryColor, "#123456");
  await m.POST(fakeReq({ primaryColor: "#000000" }));
  assert.ok(!("logoUrl" in saved[1]) && !("backgroundUrl" in saved[1]), "valeurs absentes : non touchées");
  await m.POST(fakeReq({ logoUrl: null }));
  assert.equal(saved[2].logoUrl, null, "retrait explicite conservé");
});

// ---------- 5. écran d'administration ----------
test("administration : le type d'événement de suppression tracée a son libellé", () => {
  assert.ok(read("app/app/page.js").includes("reco_draft_deleted"));
});
