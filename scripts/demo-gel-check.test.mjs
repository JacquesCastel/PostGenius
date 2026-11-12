// Test du contrôle du gel de la démonstration. Lancer : node --test scripts/demo-gel-check.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { check, readPublished, engineFiles, GIST_FILES, GEL, sha256File } from "./demo-gel-check.mjs";

test("le gel publié correspond aux fichiers du dépôt (4 fichiers du gist + le moteur)", () => {
  const r = check();
  assert.deepEqual(r.problems, []);
  assert.equal(r.checked, GIST_FILES.length + engineFiles().length);
});

test("un fichier modifié, ou une ligne retirée du gel, est détecté", () => {
  const md = fs.readFileSync(GEL, "utf8");
  const pub = readPublished(md);
  assert.ok(pub.length >= 20);
  const fausse = md.replace(pub[0].sha256, "0".repeat(64));
  const r1 = check(fausse);
  assert.equal(r1.ok, false);
  assert.match(r1.problems.join(), /ÉCART : lib\/demoEditorialCore\.mjs/);
  const sans = md.split("\n").filter((l) => !l.includes("app/api/generate/route.js")).join("\n");
  assert.match(check(sans).problems.join(), /non publié dans le gel : app\/api\/generate\/route\.js/);
});

test("le moteur figé comprend la route de génération et ses modules (linkedinRules inclus)", () => {
  const f = engineFiles();
  assert.equal(f[0], "app/api/generate/route.js");
  assert.ok(f.includes("lib/linkedinRules.js") && f.includes("lib/postMemory.js"));
  assert.ok(f.every((x) => /^[0-9a-f]{64}$/.test(sha256File(x))));
});
