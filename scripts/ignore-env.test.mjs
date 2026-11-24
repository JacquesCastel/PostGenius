// Fichiers de configuration et de secrets : jamais suivis par Git ni copiés dans l'image Docker (sauf .env.example, qui est un modèle sans secret).
// Lancer : node --test scripts/ignore-env.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const ignored = (f) => spawnSync("git", ["check-ignore", "-q", f]).status === 0;

test("Git ignore les copies du fichier de configuration, backup.env et les variantes .env.*", () => {
  for (const f of [".env", ".env.local", ".env.bak", ".env.avant-prix", ".env.avant-prix2", ".env.production", "backup.env"]) assert.equal(ignored(f), true, f);
});
test("Git continue de suivre le modèle .env.example et ne masque pas les autres fichiers", () => {
  for (const f of [".env.example", "deploy.sh", "backup-data.sh", "lib/db.js", "scripts/smoke.sh"]) assert.equal(ignored(f), false, f);
  assert.ok(spawnSync("git", ["ls-files", "--error-unmatch", ".env.example"]).status === 0, ".env.example est suivi");
});
test("l'image Docker n'embarque ni .env.*, ni backup.env (modèle .env.example conservé)", () => {
  const lines = fs.readFileSync(".dockerignore", "utf8").split("\n").map((l) => l.trim());
  for (const p of [".env", ".env.local", ".env.*", "backup.env", "!.env.example"]) assert.ok(lines.includes(p), `.dockerignore : ${p}`);
  assert.ok(lines.indexOf("!.env.example") > lines.indexOf(".env.*"), "l'exception vient après la règle générale");
});
