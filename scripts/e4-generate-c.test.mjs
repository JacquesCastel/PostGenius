// Test du script de la condition C avec un faux serveur local (aucun appel réel, aucune base). Lancer : node --test scripts/e4-generate-c.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readPrompts } from "./e4-generate.mjs";
import { readFiches, buildJobs, generateOne, NEUTRAL_PROFILE } from "./e4-generate-c.mjs";

const run = promisify(execFile);
const SCRIPT = new URL("./e4-generate-c.mjs", import.meta.url).pathname;

function server(handler) {
  const calls = [];
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { calls.push({ url: req.url, headers: req.headers, body: b ? JSON.parse(b) : null }); handler(calls.length, res); });
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, calls, base: `http://127.0.0.1:${srv.address().port}` })));
}
const json = (res, status, o) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };

test("10 fiches lues, chacune assez longue pour que le moteur ne l'ignore pas", () => {
  const f = readFiches();
  assert.equal(Object.keys(f).length, 10);
  assert.match(f.S01.facts, /^F1\. Auteur : dirigeant du cabinet fictif/);
  assert.match(f.S01.facts, /18 par mois à 7 par mois/);
  assert.ok(!f.S01.facts.includes("## ") && !f.S01.facts.includes("**Sujet**"));
  assert.ok(f.S10.facts.split("\n").every((l) => /^F\d+\./.test(l)), "S10 ne doit contenir que des lignes de faits");
});

test("20 requêtes : consigne de base mot pour mot (A/AN du fichier gelé), fiche en source, profil neutre sans consigne chiffrée", () => {
  const prompts = readPrompts();
  const jobs = buildJobs({ prompts, fiches: readFiches() });
  assert.equal(jobs.length, 20);
  assert.equal(new Set(jobs.map((j) => j.id)).size, 20);
  for (const j of jobs) {
    const [pre, s] = j.id.split("-");
    assert.equal(j.request.theme, prompts[`${pre === "C" ? "A" : "AN"}-${s}`]);
    assert.equal(j.request.source.text, readFiches()[s].facts);
    assert.ok(j.request.source.text.length >= 200);
    assert.equal(j.request.type, "simple");
  }
  assert.ok(jobs.find((j) => j.id === "C-S01").request.theme.includes("Ajoute des chiffres concrets"));
  assert.ok(!jobs.find((j) => j.id === "CN-S01").request.theme.includes("chiffres concrets"));
  assert.deepEqual(Object.keys(NEUTRAL_PROFILE).sort(), ["headline", "styleNotes"]);
});

test("--dry-run : 20 requêtes, aucun accès réseau ni base", async () => {
  const { stdout } = await run("node", [SCRIPT, "--dry-run"]);
  assert.match(stdout, /20 requête\(s\) construite\(s\), empreintes des consignes et des fiches vérifiées/);
});

test("une réponse reçue est conservée telle quelle, sans relance, avec empreinte", async () => {
  const { srv, calls, base } = await server((n, res) => json(res, 200, { text: "Post de test", why: { a: 1 }, sources: [] }));
  try {
    const rec = await generateOne({ base, cookie: "s=1", id: "C-S01", request: { theme: "t" } });
    assert.equal(calls.length, 1);
    assert.equal(rec.text, "Post de test");
    assert.equal(rec.attempts.length, 1);
    assert.match(rec.sha256, /^[0-9a-f]{64}$/);
    assert.equal(calls[0].url, "/api/generate");
    assert.equal(calls[0].headers.cookie, "s=1");
  } finally { srv.close(); }
});

test("seuls les échecs sans réponse sont relancés (503 puis 200) ; une erreur 4xx est conservée, pas relancée", async () => {
  let s = await server((n, res) => (n === 1 ? json(res, 503, { error: "x" }) : json(res, 200, { text: "ok" })));
  try {
    const rec = await generateOne({ base: s.base, cookie: "c", id: "C-S02", request: {}, retryDelayMs: 1 });
    assert.equal(s.calls.length, 2);
    assert.deepEqual(rec.attempts.map((a) => a.status), [503, 200]);
    assert.equal(rec.text, "ok");
  } finally { s.srv.close(); }
  s = await server((n, res) => json(res, 403, { error: "plan" }));
  try {
    const rec = await generateOne({ base: s.base, cookie: "c", id: "C-S03", request: {}, retryDelayMs: 1 });
    assert.equal(s.calls.length, 1);
    assert.equal(rec.status, 403);
    assert.equal(rec.text, null);
  } finally { s.srv.close(); }
});
