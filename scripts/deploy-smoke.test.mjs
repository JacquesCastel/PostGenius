// Contrôle après déploiement : adresse par défaut, surcharge, arrêt explicite si le site ne répond pas, échec explicite si les vérifications échouent.
// Lancer : node --test scripts/deploy-smoke.test.mjs (serveur local, aucun accès à Internet, aucune modification du serveur)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";

const run = (cmd, args, env = {}) => new Promise((resolve) => {
  const p = spawn(cmd, args, { env: { PATH: process.env.PATH, ...env } }); let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (code) => resolve({ code, out, err }));
});
// faux site : chaque chemin peut être réglé
function site(overrides = {}) {
  const landing = "x".repeat(31000);
  return new Promise((r) => { const s = http.createServer((req, res) => { const o = overrides[req.url]; const base = { "/api/health": [200, '{"ok":true,"db":true}'], "/": [200, landing], "/api/auth/me": [200, '{"user":null}'] }[req.url] ?? [200, "ok"]; const [c, b] = o ?? base; res.writeHead(c, { "content-type": "text/html" }); res.end(b); }); s.listen(0, "127.0.0.1", () => r({ s, url: `http://127.0.0.1:${s.address().port}` })); });
}

test("statique : adresse par défaut = site de production, partout ; plus de linkeepost.app par défaut", () => {
  for (const f of ["deploy.sh", "scripts/smoke.sh", "scripts/smoke-preflight.sh"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.match(src, /https:\/\/postgenius\.network/, `${f} : défaut postgenius.network`);
    assert.ok(!/SMOKE_URL:-https:\/\/linkeepost\.app/.test(src), `${f} : ancien défaut`);
  }
  const d = fs.readFileSync("deploy.sh", "utf8");
  assert.ok(d.includes("SMOKE_URL=\"${SMOKE_URL:-https://postgenius.network}\""), "défaut surchargeable (variable d'environnement ou .env)");
  assert.ok(d.includes("smoke-preflight.sh") && d.includes("exit 1"), "arrêt si le site ne répond pas");
  assert.ok(d.includes("SKIP_SMOKE"), "possibilité de passer outre, explicite");
  assert.ok(!/désactivé cette fois/.test(d), "plus de désactivation silencieuse du contrôle");
});
test("le contrôle avant déploiement s'exécute AVANT la copie de la base et le build (rien n'est touché en cas d'arrêt)", () => {
  const d = fs.readFileSync("deploy.sh", "utf8");
  assert.ok(d.indexOf("smoke-preflight.sh") < d.indexOf("3/7  copie de la base"));
  assert.ok(d.indexOf("smoke-preflight.sh") < d.indexOf("docker compose up"));
});
test("avant déploiement : site qui répond → 0 ; adresse passée en argument ou par SMOKE_URL", async () => {
  const s = await site();
  const a = await run("scripts/smoke-preflight.sh", [s.url]); assert.equal(a.code, 0, a.err);
  const b = await run("scripts/smoke-preflight.sh", [], { SMOKE_URL: s.url }); assert.equal(b.code, 0);
  assert.match(b.out, /répond/);
  s.s.close();
});
test("avant déploiement : site injoignable ou en panne → arrêt explicite (code 1) avec les deux issues proposées", async () => {
  const s = await site({ "/api/health": [503, "{}"] });
  const down = await run("scripts/smoke-preflight.sh", [s.url]);
  assert.equal(down.code, 1); assert.match(down.err, /ne joint pas/); assert.match(down.err, /ARRÊTÉ avant tout changement/); assert.match(down.err, /SMOKE_URL=/); assert.match(down.err, /SKIP_SMOKE=1/);
  s.s.close();
  const none = await run("scripts/smoke-preflight.sh", ["http://127.0.0.1:1"]);
  assert.equal(none.code, 1); assert.match(none.err, /code 000/);
});
test("après déploiement : toutes les vérifications passent → 0", async () => {
  const s = await site();
  const r = await run("scripts/smoke.sh", [s.url], { SMOKE_WAIT: "2" });
  assert.equal(r.code, 0, r.out + r.err); assert.match(r.out, /santé : application et base joignables/);
  s.s.close();
});
test("après déploiement : échec EXPLICITE (code 1, ligne ✗) si la santé, la page d'accueil ou une page publique échoue", async () => {
  for (const [name, ov, re] of [["santé", { "/api/health": [200, '{"ok":false}'] }, /✗ santé/], ["accueil vide", { "/": [200, "vide"] }, /✗ page d'accueil/], ["page publique", { "/tarifs": [500, "erreur"] }, /✗ \/tarifs : code 500/], ["session", { "/api/auth/me": [200, "nimporte"] }, /✗ \/api\/auth\/me/]]) {
    const s = await site(ov);
    const r = await run("scripts/smoke.sh", [s.url], { SMOKE_WAIT: "2" });
    assert.equal(r.code, 1, name); assert.match(r.out, re, name);
    s.s.close();
  }
});
test("après déploiement : site qui ne répond pas du tout → échec explicite, sans attendre indéfiniment", async () => {
  const t0 = Date.now();
  const r = await run("scripts/smoke.sh", ["http://127.0.0.1:1"], { SMOKE_WAIT: "2" });
  assert.equal(r.code, 1); assert.match(r.out, /✗ santé/);
  assert.ok(Date.now() - t0 < 30000);
});
