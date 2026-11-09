// Test du script de génération E4 avec un faux serveur local (aucun appel réseau réel). Lancer : node --test scripts/e4-generate.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readPrompts, generateOne, dPromptFor, sha256 } from "./e4-generate.mjs";

const run = promisify(execFile);
const SCRIPT = new URL("./e4-generate.mjs", import.meta.url).pathname;

function server(handler) {
  const calls = [];
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      const call = { url: req.url, headers: req.headers, body: b ? JSON.parse(b) : null }; calls.push(call);
      handler(call, calls.length, res);
    });
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, calls, base: `http://127.0.0.1:${srv.address().port}` })));
}
const ok = (res, text) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ model: "faux-modele-2026", choices: [{ message: { content: text }, finish_reason: "stop" }], usage: { total_tokens: 12 } })); };

test("les 40 consignes sont lues mot pour mot, l'empreinte du fichier est vérifiée", () => {
  const p = readPrompts();
  assert.equal(Object.keys(p).length, 40);
  assert.ok(p["A-S01"].startsWith("Écris un post LinkedIn de 150 à 250 mots sur le sujet suivant : "));
  assert.ok(!p["A-S01"].includes("Voici les informations"));
  assert.ok(p["B-S01"].includes("Voici les informations dont tu disposes :"));
  assert.ok(p["AN-S01"].endsWith("."), "consigne neutre sans « chiffres concrets »");
  assert.ok(!p["AN-S01"].includes("chiffres concrets"));
  assert.equal(dPromptFor(p, "D-S03"), p["B-S03"]);
  assert.throws(() => readPrompts(new URL("../docs/e4-chiffres/fiches-E4-fictives.md", import.meta.url).pathname), /empreinte/);
});

test("un seul message utilisateur, aucun message système, enregistrement brut avec empreinte", async () => {
  const { srv, calls, base } = await server((c, n, res) => ok(res, "Un post de test."));
  try {
    const p = readPrompts();
    const rec = await generateOne({ provider: "openai", base, model: "faux-modele", id: "A-S01", prompt: p["A-S01"], maxTokens: 100, key: "k" });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.messages, [{ role: "user", content: p["A-S01"] }]);
    assert.equal(calls[0].body.temperature, undefined);
    assert.equal(calls[0].headers.authorization, "Bearer k");
    assert.equal(rec.text, "Un post de test.");
    assert.equal(rec.modelReturned, "faux-modele-2026");
    assert.equal(rec.sha256, sha256(JSON.stringify({ ...rec, sha256: undefined })));
  } finally { srv.close(); }
});

test("relance seulement sans réponse exploitable (500), jamais après une réponse reçue", async () => {
  const { srv, calls, base } = await server((c, n, res) => { if (n === 1) { res.statusCode = 500; res.end("erreur"); } else ok(res, "ok"); });
  try {
    const p = readPrompts();
    const rec = await generateOne({ provider: "openai", base, model: "m", id: "A-S02", prompt: p["A-S02"], maxTokens: 100, key: "k", maxAttempts: 3 });
    assert.equal(calls.length, 2);
    assert.deepEqual(rec.attempts.map((a) => a.status), [500, 200]);
    assert.equal(rec.text, "ok");
  } finally { srv.close(); }
});

test("sans réponse après toutes les tentatives : échec consigné, pas de texte inventé", async () => {
  const { srv, base } = await server((c, n, res) => { res.statusCode = 503; res.end("x"); });
  try {
    const rec = await generateOne({ provider: "openai", base, model: "m", id: "A-S03", prompt: "p", maxTokens: 10, key: "k", maxAttempts: 2 });
    assert.equal(rec.failed, true);
    assert.equal(rec.text, null);
  } finally { srv.close(); }
});

test("le script n'écrase ni ne régénère un texte déjà enregistré", async () => {
  const { srv, calls, base } = await server((c, n, res) => ok(res, `texte ${n}`));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "e4-"));
  try {
    const args = [SCRIPT, "--provider", "openai", "--model", "m", "--out", out, "--base-url", base, "--only", "A-S01,A-S02"];
    await run("node", args);
    assert.equal(calls.length, 2);
    const first = fs.readFileSync(path.join(out, "A-S01.json"), "utf8");
    const r2 = await run("node", args);
    assert.equal(calls.length, 2, "aucun nouvel appel");
    assert.match(r2.stdout, /déjà généré/);
    assert.equal(fs.readFileSync(path.join(out, "A-S01.json"), "utf8"), first);
  } finally { srv.close(); fs.rmSync(out, { recursive: true, force: true }); }
});

test("condition D : les dix consignes de B, appelées sur l'API Anthropic (format Messages)", async () => {
  const { srv, calls, base } = await server((c, n, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ model: "faux-claude", content: [{ type: "text", text: "post D" }], stop_reason: "end_turn", usage: {} })); });
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "e4d-"));
  try {
    await run("node", [SCRIPT, "--provider", "anthropic", "--model", "m", "--out", out, "--base-url", base, "--only", "D-S04"]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/v1/messages");
    assert.equal(calls[0].body.system, undefined);
    assert.equal(calls[0].body.messages[0].content, readPrompts()["B-S04"]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, "D-S04.json"), "utf8")).text, "post D");
  } finally { srv.close(); fs.rmSync(out, { recursive: true, force: true }); }
});
