// Nom affiché : Vercéa partout où un visiteur le lit ; exceptions listées et gardées ; domaine et adresses e-mail inchangés.
// Lancer : node --test scripts/nom-affiche.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BRAND_NAME, BRAND_ANCIEN } from "../lib/brand.js";
import { NOM_DU_TEST } from "../lib/e4Page.js";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|mjs)$/.test(e)) out.push(rel);
  }
  return out;
}
const fichiersGeles = readFileSync(join(ROOT, "docs/demo-editoriale/gel-demo-empreintes.md"), "utf8").match(/`((?:lib|app|scripts|docs)\/[^`\s]+)`/g)?.map((x) => x.slice(1, -1)) ?? [];

test("le nom est Vercéa ; l'ancien nom n'est gardé que pour citer le test E4", () => {
  assert.equal(BRAND_NAME, "Vercéa");
  assert.equal(BRAND_ANCIEN, "LinkeePost");
  assert.equal(NOM_DU_TEST, "LinkeePost");
});

test("plus aucune occurrence de « LinkeePost » dans l'application, sauf exceptions voulues", () => {
  const EXCEPTIONS = new Map([
    ["app/privacy-policy/page.js", "politique en anglais : adresse déclarée à LinkedIn, à renommer avec l'application LinkedIn"],
    ["lib/brand.js", "BRAND_ANCIEN"],
    ["lib/e4Page.js", "nom du produit au moment du test E4"],
    ["lib/gating.js", "fichier gelé de la démo"], ["lib/knowledge.js", "fichier gelé de la démo"], ["lib/demoEditorialCore.mjs", "fichier gelé de la démo"],
  ]);
  const restes = [];
  for (const f of [...walk("app"), ...walk("components"), ...walk("lib")]) {
    if (EXCEPTIONS.has(f) || fichiersGeles.includes(f)) continue;
    read(f).split("\n").forEach((l, i) => { if (l.includes("LinkeePost") && !/User-Agent/.test(l)) restes.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(restes, [], `occurrences restantes : ${restes.join(", ")}`);
});

test("les fichiers gelés de la démo ne sont pas touchés (le gel reste conforme)", () => {
  assert.ok(fichiersGeles.length >= 20, `${fichiersGeles.length} fichiers gelés lus`);
  assert.match(read("lib/gating.js"), /utiliser LinkeePost\./, "message gelé conservé tel quel");
});

test("domaine affiché : plus d'adresse du site figée sur l'ancien domaine ; les adresses e-mail ne changent pas ici", () => {
  const restes = [];
  for (const f of [...walk("app"), ...walk("components"), ...walk("lib")]) {
    if (f === "app/privacy-policy/page.js") continue; // texte déclaré à LinkedIn : à changer avec l'application LinkedIn
    read(f).split("\n").forEach((l, i) => { if (/linkeepost\.app/.test(l) && !/contact@linkeepost\.app/.test(l)) restes.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(restes, [], `adresses restantes : ${restes.join(", ")}`);
  assert.match(read("lib/contact.js"), /contact@linkeepost\.app/, "boîte de contact : décision séparée (CONTACT_EMAIL)");
  assert.match(read("lib/authEmails.js"), /process\.env\.APP_URL \|\| "https:\/\/vercea\.app"/);
  assert.match(read("app/sitemap.js"), /process\.env\.APP_URL \|\| "https:\/\/vercea\.app"/);
});

test("les données structurées lisent APP_URL (le domaine réellement servi) ; l'image de partage et l'animation affichent vercea.app", () => {
  const j = read("components/home/JsonLd.js");
  assert.match(j, /const site = \(process\.env\.APP_URL \|\| "https:\/\/vercea\.app"\)/);
  assert.match(j, /url: site/);
  assert.match(j, /logo: `\$\{site\}\/icon\.svg`/);
  assert.doesNotMatch(j, /linkeepost/);
  assert.match(read("app/opengraph-image.js"), />vercea\.app<\/div>/);
  assert.match(read("components/BrandMotion.js"), />vercea\.app<\/div>/);
});

test("les User-Agent techniques gardent leur identifiant (des sites peuvent les autoriser)", () => {
  assert.match(read("lib/veille.js"), /"User-Agent": "LinkeePost\/1\.0/);
});

test("les pages de preuve citent le test sous son nom de l'époque, avec mention du nouveau", () => {
  const t = read("app/preuves/test-e4/page.js");
  assert.match(t, /Au moment du test, le produit s&apos;appelait \{NOM_DU_TEST\} ; il s&apos;appelle aujourd&apos;hui \{BRAND_NAME\}/);
  assert.doesNotMatch(t.replace(/title: `[^`]*`/, ""), /\$\{BRAND_NAME\} (en a produit|a produit)/);
  assert.match(read("lib/e4Page.js"), /LinkeePost \(aujourd'hui Vercéa\), avec les faits/);
});

test("les e-mails et la page de partage utilisent le nouveau nom", () => {
  for (const f of ["lib/invites.js", "lib/agencyTeam.js", "lib/emailLayout.js", "lib/lifecycleEmails.js"]) assert.ok(read(f).includes("Vercéa"), f);
  assert.match(read("app/manifest.js"), /name: "Vercéa"/);
  assert.match(read("app/layout.js"), /siteName: "Vercéa"/);
});
