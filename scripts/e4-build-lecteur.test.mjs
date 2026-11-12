// Test de la page de lecture E4 : le contenu correspond au lot de classement, rien d'autre n'y figure. Lancer : node --test scripts/e4-build-lecteur.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { buildData, buildHtml } from "./e4-build-lecteur.mjs";

const lot = fs.readFileSync(new URL("../docs/e4-chiffres/anonymisation/lot-classement.md", import.meta.url), "utf8");

test("70 textes, 10 sujets, chaque texte identique à celui du lot de classement", () => {
  const d = buildData();
  assert.equal(d.texts.length, 70);
  assert.equal(d.subjects.length, 10);
  assert.equal(new Set(d.texts.map((t) => t.id)).size, 70);
  for (const t of d.texts) assert.ok(lot.includes(`### ${t.id}\n\n${t.text}\n`), `${t.id} diffère du lot`);
  for (const s of d.subjects) assert.ok(s.facts.length >= 4 && s.facts.every((f) => /^F\d+\./.test(f)), s.id);
});

test("l'ordre dans chaque sujet est celui du lot (mélangé), les sujets sont dans l'ordre", () => {
  const d = buildData();
  const order = [...lot.matchAll(/^### (T-[0-9A-Z]{4})$/gm)].map((m) => m[1]);
  assert.deepEqual(d.texts.map((t) => t.id), order);
});

test("la page est autonome : données intégrées et échappées, aucun fichier externe sauf polices, aucune condition", () => {
  const html = buildHtml(buildData());
  assert.ok(!html.includes("/*__DATA__*/"));
  const m = html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/);
  assert.ok(m);
  assert.equal(JSON.parse(m[1]).texts.length, 70);
  assert.ok(!/<\/script>[\s\S]*<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/.test(html), "un texte ne doit pas fermer une balise script");
  assert.ok(!/<(html|head|body)[\s>]/i.test(html), "le gabarit de publication fournit ces balises");
  assert.ok(html.startsWith("<title>"));
  const hosts = [...html.matchAll(/https?:\/\/[^"')\s]+/g)].map((x) => new URL(x[0]).host);
  assert.deepEqual([...new Set(hosts)].sort(), ["fonts.googleapis.com"]);
  for (const mot of ["cle-anonymisation", "NE-PAS-OUVRIR"]) assert.ok(!html.includes(mot), mot);
  const data = JSON.parse(m[1]);
  assert.deepEqual(Object.keys(data), ["subjects", "texts"]);
  assert.ok(data.texts.every((t) => Object.keys(t).sort().join() === "id,subject,text"), "un texte ne porte que identifiant, sujet et texte");
});

test("le script JavaScript de la page est syntaxiquement valide", () => {
  const html = buildHtml(buildData());
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  assert.equal(scripts.length, 1);
  fs.writeFileSync("/tmp/e4-lecteur-check.js", scripts[0]);
  execFileSync("node", ["--check", "/tmp/e4-lecteur-check.js"]);
});

test("le script de construction ne lit jamais la clé", () => {
  const src = fs.readFileSync(new URL("./e4-build-lecteur.mjs", import.meta.url), "utf8");
  assert.ok(!/NE-PAS-OUVRIR|cle-anonymisation\.json/.test(src.replace(/^\/\/.*$/gm, "")));
});
