// Sélecteur de pilier facultatif de l'écran de création : câblage lu dans le source (le serveur contrôle déjà l'appartenance : security-ownership.test.mjs).
// Lancer : node --test scripts/pillar-selector.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/app/page.js", import.meta.url), "utf8");

test("le pilier envoyé : choix manuel d'abord (y compris « aucun »), sinon celui de la proposition", () => {
  assert.match(page, /pillarId: manualPillarId !== undefined \? manualPillarId : activeReco\?\.pillarId \?\? null,/);
  assert.match(page, /useState\(undefined\);\s*\n\s*const \[pillarChoices/); // undefined = pas de choix manuel
});

test("le sélecteur est facultatif, sans numéro d'étape, et se masque si aucun pilier n'est chargé", () => {
  const start = page.indexOf('data-testid="pillar-block"');
  const block = page.slice(start, page.indexOf("})()}", start));
  assert.match(page, /pillarChoices\.length > 0 && \(\(\) =>/);
  assert.match(block, /facultatif/);
  assert.doesNotMatch(block, /blockNum\(/);
  assert.match(block, /setManualPillarId\(current === p\.id \? null : p\.id\)/); // un second clic retire le pilier
});

test("le choix manuel est remis à zéro avec la zone de résultat (jamais reporté sur le post suivant)", () => {
  assert.match(page, /const clearResultArea = \(\) => \{\s*\n\s*setManualPillarId\(undefined\);/);
});

test("les piliers sont lus par la route existante, uniquement sur l'écran de création, sans bloquer en cas d'échec", () => {
  assert.match(page, /view !== "create" \|\| pillarChoices\.length\) return;\s*\n\s*fetch\("\/api\/editorial\/pillars"\)[\s\S]{0,160}\.catch\(\(\) => \{\}\)/);
});
