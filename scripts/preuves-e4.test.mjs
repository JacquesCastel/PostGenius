// Pages /preuves et /preuves/test-e4 : chiffres fidèles au compte rendu, pages fermées par défaut, rien de promis.
// Lancer : node --test scripts/preuves-e4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { E4 } from "../lib/e4Page.js";
import { preuvesOuvertes } from "../lib/sitePreuves.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const cr = read("docs/e4-chiffres/compte-rendu/compte-rendu-E4.md");

test("chaque moyenne affichée figure dans le compte rendu, avec son nombre de textes", () => {
  for (const c of E4.conditions) {
    const ligne = cr.split("\n").find((l) => l.includes(`**${c.moyenne}**`) && l.includes(`${c.textes} sur 10`));
    assert.ok(ligne, `condition ${c.code} : ${c.moyenne} · ${c.textes} sur 10 absent du compte rendu`);
    assert.equal(c.valeur, Number(c.moyenne.replace(",", ".")), `valeur numérique de ${c.code}`);
  }
});

test("la lecture sans chiffres d'exemple est celle du compte rendu (A, B, D, C)", () => {
  const l = cr.split("\n").find((x) => x.startsWith("| Moyenne I + X + D par post"));
  const [A, B, C, D] = l.split("|").slice(2, 6).map((s) => s.trim()); // colonnes A B C D
  assert.deepEqual(E4.sansExemples, [A, B, D, C]);
});

test("le tableau des types de faits et ses totaux sont ceux du compte rendu", () => {
  for (const [nom, releves, inventes] of E4.types) assert.ok(cr.includes(`| ${nom} | ${releves} | ${inventes} |`), nom);
  assert.ok(cr.includes(`| **Total** | **${E4.total[0]}** | **${E4.total[1]}** |`));
  assert.equal(E4.types.reduce((s, t) => s + t[1], 0), E4.total[0]);
  assert.equal(E4.types.reduce((s, t) => s + t[2], 0), E4.total[1]);
});

test("les adresses de publication datée viennent du compte rendu ; les fichiers cités existent", () => {
  for (const url of Object.values(E4.gists)) assert.ok(cr.includes(url), url);
  for (const f of ["compte-rendu/annexe-textes.md", "classement/grille-elements-claude.csv"]) assert.ok(readFileSync(new URL(`../docs/e4-chiffres/${f}`, import.meta.url)).length > 0, f);
  const proto = read("docs/e4-chiffres/gel-E4-empreintes.md") + read("docs/e4-chiffres/journal-E4.md") + cr;
  assert.ok(proto.includes(E4.empreinte), "empreinte du protocole");
});

test("fermées par défaut : 404 sans SITE_PREUVES=1, ouvertes seulement avec cette valeur exacte", () => {
  assert.equal(preuvesOuvertes({}), false);
  assert.equal(preuvesOuvertes({ SITE_PREUVES: "true" }), false);
  assert.equal(preuvesOuvertes({ SITE_PREUVES: "0" }), false);
  assert.equal(preuvesOuvertes({ SITE_PREUVES: "1" }), true);
  for (const p of ["app/preuves/page.js", "app/preuves/test-e4/page.js"]) {
    const s = read(p);
    assert.match(s, /if \(!preuvesOuvertes\(\)\) notFound\(\);/, p);
    assert.match(s, /export const dynamic = "force-dynamic"/, p);
  }
});

test("pages non branchées : ni plan du site, ni navigation, ni promesse de résultat", () => {
  assert.doesNotMatch(read("app/sitemap.js"), /preuves/);
  assert.doesNotMatch(read("components/SiteHeader.js"), /preuves/);
  assert.doesNotMatch(read("components/SiteFooter.js"), /preuves/);
  for (const p of ["app/preuves/page.js", "app/preuves/test-e4/page.js", "lib/e4Page.js"]) {
    assert.doesNotMatch(read(p), /garanti|100 ?%|aucune erreur|jamais d'erreur|le plus fiable/i, p);
  }
});

test("les formules écrites en dur dans la page viennent du compte rendu ou des consignes publiées", () => {
  const page = read("app/preuves/test-e4/page.js");
  const consignes = read("docs/e4-chiffres/consignes-E4-chatgpt-40.md");
  for (const phrase of ["33 contre 64", "seize personnes", "près des trois quarts", "gpt-5.5-2026-04-23", "claude-sonnet-4-6", "15:14 UTC", "15:40 UTC", "09:46 UTC", "10:03", "8 à 10 posts sur 10", "six mois plus tard", "Sept conditions", "un hashtag"]) {
    assert.ok(page.includes(phrase) || E4.gel.includes(phrase), `phrase absente de la page : ${phrase}`);
    assert.ok(cr.includes(phrase), `phrase absente du compte rendu : ${phrase}`);
  }
  assert.ok(cr.includes(`de ${E4.conditions[0].moyenne} à ${E4.conditions[1].moyenne}`), "réduction de A à B");
  assert.ok(page.includes("Ajoute des chiffres concrets pour le rendre crédible") && consignes.includes("Ajoute des chiffres concrets pour le rendre crédible"));
});
