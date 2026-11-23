// Désautorisation Instagram : signature de Meta vérifiée (HMAC-SHA256, temps constant) avant toute suppression.
// Lancer : node --test scripts/instagram-signed-request.test.mjs (base simulée)
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySignedRequest, SignedRequestError } from "../lib/instagramSignedRequest.js";
import { loadModule, fakeReq } from "./_harness.mjs";

const SECRET = "secret-de-l-application-de-test";
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sign = (payload, secret = SECRET, algo = "sha256") => { const p = b64u(JSON.stringify(payload)); return `${b64u(crypto.createHmac(algo, secret).update(p).digest())}.${p}`; };
const refused = (fn) => { try { fn(); return null; } catch (e) { return e instanceof SignedRequestError ? e.message : `autre:${e.message}`; } };

test("signature valide : la charge utile est rendue", () => {
  const p = verifySignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "17841400000000000", issued_at: 1 }), SECRET);
  assert.equal(p.user_id, "17841400000000000");
});
test("charge utile modifiée, mauvais secret, signature absente ou tronquée : refus", () => {
  const good = sign({ algorithm: "HMAC-SHA256", user_id: "111" });
  const [sig] = good.split(".");
  const forged = `${sig}.${b64u(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "222" }))}`;
  assert.equal(refused(() => verifySignedRequest(forged, SECRET)), "Signature invalide.");
  assert.equal(refused(() => verifySignedRequest(good, "autre-secret")), "Signature invalide.");
  assert.equal(refused(() => verifySignedRequest(good.slice(1), SECRET)), "Signature invalide.");
  assert.equal(refused(() => verifySignedRequest(`.${good.split(".")[1]}`, SECRET)), "Requête signée mal formée.");
  assert.equal(refused(() => verifySignedRequest(sig, SECRET)), "Requête signée mal formée.");
  assert.equal(refused(() => verifySignedRequest("a.b.c", SECRET)), "Requête signée mal formée.");
  assert.equal(refused(() => verifySignedRequest("", SECRET)), "Requête signée mal formée.");
  assert.equal(refused(() => verifySignedRequest(null, SECRET)), "Requête signée mal formée.");
});
test("un secret absent est un refus (jamais un passe-droit)", () => {
  assert.ok(refused(() => verifySignedRequest(sign({ user_id: "1" }), "")));
  assert.ok(refused(() => verifySignedRequest(sign({ user_id: "1" }), undefined)));
});
test("signature calculée avec un autre algorithme, ou charge utile annonçant un autre algorithme : refus", () => {
  assert.equal(refused(() => verifySignedRequest(sign({ user_id: "1" }, SECRET, "sha1"), SECRET)), "Signature invalide.");
  assert.equal(refused(() => verifySignedRequest(sign({ algorithm: "HMAC-SHA1", user_id: "1" }), SECRET)), "Algorithme non pris en charge.");
});
test("caractères hors base64url, charge utile non JSON : refus", () => {
  assert.equal(refused(() => verifySignedRequest("sig!.pay", SECRET)), "Requête signée mal formée.");
  const p = b64u("pas du json"); const sig = b64u(crypto.createHmac("sha256", SECRET).update(p).digest());
  assert.equal(refused(() => verifySignedRequest(`${sig}.${p}`, SECRET)), "Charge utile illisible.");
});

// --- la route : aucune suppression sans signature valide ---
async function post(body, secret = SECRET) { if (secret === null) secret = undefined;
  const rows = [{ igUserId: "17841400000000000" }, { igUserId: "999" }];
  const prisma = { instagramAccount: { deleteMany: async ({ where }) => { const n = rows.filter((r) => r.igUserId === where.igUserId).length; for (let i = rows.length - 1; i >= 0; i--) if (rows[i].igUserId === where.igUserId) rows.splice(i, 1); return { count: n }; } } };
  const saved = process.env.INSTAGRAM_APP_SECRET; if (secret === undefined) delete process.env.INSTAGRAM_APP_SECRET; else process.env.INSTAGRAM_APP_SECRET = secret;
  try {
    const lib = await loadModule("lib/instagramSignedRequest.js", {});
    const m = await loadModule("app/api/instagram/deauthorize/route.js", { prisma, stubs: { verifySignedRequest: lib.verifySignedRequest, SignedRequestError: lib.SignedRequestError } });
    const req = { text: async () => body, headers: new Headers() };
    const res = await m.POST(req);
    return { res, rows };
  } finally { if (saved === undefined) delete process.env.INSTAGRAM_APP_SECRET; else process.env.INSTAGRAM_APP_SECRET = saved; }
}
const form = (sr) => new URLSearchParams({ signed_request: sr }).toString();

test("route : signature valide → le compte Instagram désigné est déconnecté, pas les autres", async () => {
  const { res, rows } = await post(form(sign({ algorithm: "HMAC-SHA256", user_id: "17841400000000000" })));
  assert.equal(res.status, 200);
  assert.deepEqual(rows.map((r) => r.igUserId), ["999"]);
});
test("route : signature falsifiée → refus 400, aucune suppression", async () => {
  const { res, rows } = await post(form(sign({ algorithm: "HMAC-SHA256", user_id: "17841400000000000" }, "mauvais-secret")));
  assert.equal(res.status, 400);
  assert.equal(rows.length, 2);
});
test("route : sans requête signée, ou corps illisible → refus 400, aucune suppression", async () => {
  assert.equal((await post("")).res.status, 400);
  assert.equal((await post("n'importe quoi")).res.status, 400);
  assert.equal((await post(form("pas-signee"))).rows.length, 2);
});
test("route : secret de l'application non configuré → refus 503, aucune suppression", async () => {
  const { res, rows } = await post(form(sign({ algorithm: "HMAC-SHA256", user_id: "17841400000000000" })), null);
  assert.equal(res.status, 503);
  assert.equal(rows.length, 2);
});
