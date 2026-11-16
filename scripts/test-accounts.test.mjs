// Scripts de création des comptes de test : aucun mot de passe écrit dans le code ; mot de passe aléatoire, affiché une fois ; réinitialisation explicite.
// Lancer : node --test scripts/test-accounts.test.mjs (base et chiffrement simulés)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCRIPTS = ["create-essentiel.mjs", "create-demo-account.mjs"];
const read = (f) => fs.readFileSync(new URL(`../scripts/${f}`, import.meta.url), "utf8");

test("aucun mot de passe en clair dans le code", () => {
  for (const f of SCRIPTS) {
    const src = read(f);
    assert.ok(!/PASSWORD\s*=\s*["'`]/.test(src), `${f} : mot de passe littéral`);
    assert.ok(!/(Essentiel|Demo)2026/.test(src), `${f} : ancien mot de passe`);
    assert.ok(src.includes("crypto.randomBytes"), `${f} : mot de passe aléatoire`);
  }
});

async function run(file, existing, argv = [], env = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acct-"));
  const f = path.join(tmp, `s-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, read(file).replace('import { PrismaClient } from "@prisma/client";', "const PrismaClient = globalThis.__P;").replace('import bcrypt from "bcryptjs";', 'const bcrypt = { hash: async (p) => "hash:" + p };'));
  const calls = [];
  globalThis.__P = class { user = {
    findUnique: async () => existing,
    create: async (q) => { calls.push(["create", q]); return { email: q.data.email, plan: q.data.plan }; },
    update: async (q) => { calls.push(["update", q]); return { email: "x", plan: "essentiel" }; },
  }; $disconnect = async () => {}; };
  const out = []; const log = console.log; console.log = (...a) => out.push(a.join(" "));
  const argvBefore = process.argv; process.argv = ["node", "s", ...argv];
  const envBefore = { ...process.env }; Object.assign(process.env, env);
  try { await import(pathToFileURL(f).href); } finally { console.log = log; process.argv = argvBefore; process.env = envBefore; }
  return { out: out.join("\n"), calls };
}

for (const file of SCRIPTS) {
  test(`${file} : création avec mot de passe aléatoire, affiché une fois, stocké chiffré`, async () => {
    const a = await run(file, null);
    const b = await run(file, null);
    const create = a.calls.find((c) => c[0] === "create");
    assert.ok(create, "compte créé");
    const shown = a.out.match(/[Pp]assword\s*:\s*(\S+)/)[1];
    assert.ok(shown.length >= 20, "au moins 20 caractères");
    assert.equal(create[1].data.password, `hash:${shown}`, "le mot de passe affiché est celui qui est chiffré");
    assert.notEqual(shown, b.out.match(/[Pp]assword\s*:\s*(\S+)/)[1], "différent à chaque création");
    assert.ok(!/(Essentiel|Demo)2026/.test(a.out));
  });

  test(`${file} : compte existant, mot de passe inchangé sans --reset-password, nouveau avec`, async () => {
    const keep = await run(file, { email: "x" });
    assert.ok(!keep.calls.some((c) => c[1]?.data?.password), "aucun mot de passe modifié");
    assert.match(keep.out, /inchangé/);
    const reset = await run(file, { email: "x" }, ["--reset-password"]);
    const upd = reset.calls.find((c) => c[0] === "update" && c[1].data.password);
    assert.ok(upd, "mot de passe réinitialisé");
    assert.equal(upd[1].data.password, `hash:${reset.out.match(/[Pp]assword\s*:\s*(\S+)/)[1]}`);
  });

  test(`${file} : TEST_ACCOUNT_PASSWORD impose un mot de passe`, async () => {
    const r = await run(file, null, [], { TEST_ACCOUNT_PASSWORD: "ChoisiParMoi-42" });
    assert.equal(r.calls.find((c) => c[0] === "create")[1].data.password, "hash:ChoisiParMoi-42");
  });
}
