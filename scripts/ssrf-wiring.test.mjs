// Chemins qui lisent une adresse saisie par un client : tous passent par lib/safeFetch.js ; images de gabarit limitées aux images de LinkeePost.
// Lancer : node --test scripts/ssrf-wiring.test.mjs (réseau et base simulés)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadModule, fakeReq } from "./_harness.mjs";
import { SafeFetchError } from "../lib/safeFetch.js";
import { isOwnAsset, guardKitAssets, guardTemplate } from "../lib/assetUrl.js";

const read = (f) => fs.readFileSync(f, "utf8");
const code = (f) => read(f).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

test("statique : aucun appel direct à fetch() sur une adresse d'utilisateur dans les chemins concernés", () => {
  for (const f of ["lib/veille.js", "lib/safePage.js", "app/api/events/analyze/route.js", "app/api/knowledge/route.js", "app/api/generate/source/route.js", "lib/repurpose.js", "lib/mcp.js"]) {
    const direct = code(f).split("\n").filter((l) => /(^|[^.\w])fetch\(/.test(l) && !l.includes("https://api.anthropic.com/")); // l'appel au fournisseur d'IA a une adresse fixe
    assert.deepEqual(direct, [], `${f} : fetch( direct sur une adresse variable`);
  }
});
test("statique : les appelants n'utilisent plus la lecture de page du fichier gelé", () => {
  for (const f of ["app/api/knowledge/route.js", "app/api/generate/source/route.js", "lib/repurpose.js", "lib/mcp.js"]) {
    assert.ok(/fetchPageTextSafe/.test(read(f)), `${f} utilise la version sécurisée`);
    assert.ok(!/[^e]fetchPageText\(/.test(code(f)), `${f} n'appelle plus fetchPageText`);
  }
});
test("statique : le gabarit appelle le contrôle des images", () => {
  const t = read("lib/templates.js");
  assert.ok(t.includes("guardKitAssets(kit)") && t.includes("guardTemplate"));
});

// --- lecture d'une page (base de connaissances, génération, série, MCP) ---
const text = await loadModule("lib/knowledgeText.js", {});
const page = async (fake) => (await loadModule("lib/safePage.js", { stubs: { safeGet: fake, SafeFetchError, htmlToText: text.htmlToText, cleanText: text.cleanText } })).fetchPageTextSafe;
const html = (body) => ({ ok: true, status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: Buffer.from(`<html><head><title>Titre</title></head><body><p>${body}</p></body></html>`) });
const msg = async (fn) => { try { await fn(); return "ok"; } catch (e) { return e.message; } };

test("lecture de page : adresse interdite → message habituel, sans autre détail", async () => {
  const f = await page(async () => { throw new SafeFetchError("blocked", "Adresse non autorisée."); });
  assert.equal(await msg(() => f("http://169.254.169.254/")), "Adresse invalide ou non autorisée.");
  const g = await page(async () => { throw new SafeFetchError("invalid", "Port non autorisé."); });
  assert.equal(await msg(() => g("http://x:22/")), "Adresse invalide ou non autorisée.");
});
test("lecture de page : panne réseau, erreur HTTP, type de contenu, texte trop court : mêmes messages qu'avant", async () => {
  assert.equal(await msg(async () => (await page(async () => { throw new SafeFetchError("timeout", "Délai dépassé."); }))("https://a.test/")), "Impossible de joindre cette adresse.");
  assert.equal(await msg(async () => (await page(async () => ({ ok: false, status: 404, headers: {}, body: Buffer.alloc(0) })))("https://a.test/")), "Cette page répond une erreur (404).");
  assert.match(await msg(async () => (await page(async () => ({ ok: true, status: 200, headers: { "content-type": "application/pdf" }, body: Buffer.alloc(1) })))("https://a.test/")), /^Seules les pages web et les textes sont lus ici/);
  assert.match(await msg(async () => (await page(async () => html("trop court")))("https://a.test/")), /^Cette page ne contient pas assez de texte lisible/);
});
test("lecture de page : une page publique est lue (titre et texte)", async () => {
  const f = await page(async () => html("Un texte assez long. ".repeat(30)));
  const r = await f("https://a.test/");
  assert.equal(r.title, "Titre");
  assert.ok(r.text.length >= 200);
});
test("messages d'erreur : les mêmes que ceux du fichier gelé (lib/knowledge.js)", () => {
  const frozen = read("lib/knowledge.js"), safe = read("lib/safePage.js");
  for (const m of ["Adresse invalide ou non autorisée.", "Impossible de joindre cette adresse.", "Cette page répond une erreur (", "Seules les pages web et les textes sont lus ici", "Cette page ne contient pas assez de texte lisible"]) { assert.ok(frozen.includes(m) && safe.includes(m), m); }
});

// --- veille (flux RSS) ---
test("veille : une adresse interdite est refusée par la lecture sécurisée ; aucun appel direct à fetch", async () => {
  const realFetch = globalThis.fetch; let direct = 0; globalThis.fetch = async () => { direct++; throw new Error("fetch direct interdit"); };
  try {
    const v = await loadModule("lib/veille.js", { stubs: { safeGet: async () => { throw new SafeFetchError("blocked", "x"); }, SafeFetchError } });
    assert.equal(await msg(() => v.resolveSource("https://flux.example.com/rss")), "URL non autorisée.");
    const feed = `<?xml version="1.0"?><rss><channel><item><title>Article</title><link>https://a.test/1</link><description>Texte</description></item></channel></rss>`;
    const ok = await loadModule("lib/veille.js", { stubs: { safeGet: async () => ({ ok: true, status: 200, headers: { "content-type": "application/rss+xml" }, body: Buffer.from(feed) }), SafeFetchError } });
    const r = await ok.resolveSource("https://flux.example.com/rss");
    assert.equal(r.items.length, 1);
    assert.equal(direct, 0);
  } finally { globalThis.fetch = realFetch; }
});

// --- analyse d'un événement ---
async function analyze(safeGet, url) {
  const realFetch = globalThis.fetch; let direct = 0; globalThis.fetch = async () => { direct++; throw new Error("fetch direct interdit"); };
  try {
    const sharp = () => ({ png: () => ({ toBuffer: async () => Buffer.from("png") }) });
    const m = await loadModule("app/api/events/analyze/route.js", { stubs: { getUserId: async () => "u1", saveImage: async () => ({ url: "/api/images/0123456789abcdef.png" }), safeGet, sharp } });
    const res = await m.POST(fakeReq({ url }));
    return { res, direct };
  } finally { globalThis.fetch = realFetch; }
}
test("analyse d'événement : adresse interne refusée (page, image et page d'accueil passent par la lecture sécurisée)", async () => {
  const calls = [];
  const { res, direct } = await analyze(async (u) => { calls.push(u); throw new SafeFetchError("blocked", "Adresse non autorisée."); }, "http://169.254.169.254/latest/meta-data/");
  assert.equal(res.status, 502);
  assert.match(res.body.error, /^Impossible de lire le lien/);
  assert.deepEqual(calls, ["http://169.254.169.254/latest/meta-data/"]);
  assert.equal(direct, 0, "aucun fetch direct");
});
test("analyse d'événement : une page publique est analysée, l'image est rapatriée par la lecture sécurisée", async () => {
  const calls = [];
  const page = `<html><head><title>Salon</title><meta property="og:image" content="https://cdn.example.com/a.png"><meta name="description" content="Un salon"></head><body>Bonjour</body></html>`;
  const { res, direct } = await analyze(async (u) => { calls.push(u); return u.endsWith(".png") ? { ok: true, status: 200, headers: {}, body: Buffer.from("img") } : { ok: true, status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(page) }; }, "https://salon.example.com/evt");
  assert.equal(res.status, 200);
  assert.ok(calls.includes("https://cdn.example.com/a.png"));
  assert.equal(direct, 0);
});

// --- images des gabarits ---
test("gabarits : seules les images de LinkeePost et les images intégrées sont acceptées", () => {
  const app = "https://postgenius.network";
  for (const ok of ["/api/images/logos/abc-1234.png", "/api/images/backgrounds/u-aa.jpg", "/api/images/0123456789abcdef.png", "https://postgenius.network/api/images/logos/x.png", "data:image/png;base64,iVBORw0KGgo="]) assert.equal(isOwnAsset(ok, app), true, ok);
  for (const bad of ["http://169.254.169.254/latest", "http://localhost:3000/api/health", "https://evil.example.com/api/images/x.png", "//evil.example.com/a.png", "/api/images/../../etc/passwd", "/etc/passwd", "file:///etc/passwd", "javascript:alert(1)", "data:text/html;base64,PGh0bWw+", "http://postgenius.network@evil.com/api/images/x.png", "", null, undefined, 42]) assert.equal(isOwnAsset(bad, app), false, String(bad));
});
test("gabarits : charte et modèle personnalisé sans images externes ; le reste est conservé", () => {
  const kit = guardKitAssets({ primaryColor: "#123456", logoUrl: "http://10.0.0.1/logo.png", backgroundUrl: "/api/images/backgrounds/u-aa.jpg" }, "https://postgenius.network");
  assert.equal(kit.logoUrl, null); assert.equal(kit.backgroundUrl, "/api/images/backgrounds/u-aa.jpg"); assert.equal(kit.primaryColor, "#123456");
  const t = guardTemplate({ elements: [{ type: "image", src: "http://10.0.0.1/x.png" }, { type: "image", src: "/api/images/0123456789abcdef.png" }, { type: "text", text: "ok" }, { type: "image", role: "logo" }] }, "https://postgenius.network");
  assert.equal(t.elements[0].src, null); assert.equal(t.elements[1].src, "/api/images/0123456789abcdef.png"); assert.equal(t.elements[2].text, "ok");
  assert.equal(guardTemplate(undefined), undefined);
});
