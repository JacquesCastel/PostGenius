// Article de correction (outputs/blog-correction-controle-des-chiffres.md) : format de saisie de l'administration du blog et rendu du site.
// Lancer : node --test scripts/blog-correction.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const file = new URL("../outputs/blog-correction-controle-des-chiffres.md", import.meta.url);
const raw = fs.readFileSync(file, "utf8");
const m = raw.match(/## TITRE\n(.*)\n\n## RÉSUMÉ[^\n]*\n(.*)\n\n## CONTENU[^\n]*\n([\s\S]*)$/);

test("format de saisie : titre, résumé de longueur raisonnable, contenu", () => {
  assert.ok(m, "sections TITRE, RÉSUMÉ, CONTENU");
  assert.ok(m[1].length <= 100, `titre : ${m[1].length} caractères`);
  assert.ok(m[2].length >= 100 && m[2].length <= 170, `résumé : ${m[2].length} caractères`);
  assert.ok(m[3].length > 1500);
});

test("rien que le rendu du site ne sait pas afficher : ni tableau, ni bloc de code, ni séparateur", () => {
  const body = m[3];
  assert.ok(!/^\s*\|/m.test(body), "tableau");
  assert.ok(!/```/.test(body), "bloc de code");
  assert.ok(!/^---+\s*$/m.test(body), "séparateur");
  assert.ok(!/^# /m.test(body), "titre de niveau 1 dans le contenu");
});

test("la correction est datée, sans champ à compléter, et ne promet rien de plus que le produit", () => {
  const body = m[3];
  assert.match(body, /16 novembre 2026/);
  assert.match(body, /12 novembre 2026/);
  assert.ok(!/\[[^\]]*(à compléter|date|N)\]/i.test(body), "aucun crochet à remplir");
  assert.ok(!/(est|sont|sera|seront) garanti|nous garantissons|garantit que|certifi/i.test(body), "pas de promesse de garantie");
  assert.match(body, /indicatif/);
});
