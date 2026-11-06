// Contrôle indicatif des chiffres d'un post généré (lib/figureCheck.js). Lancer : node --test scripts/figure-check.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { numberBase, figuresToCheck } from "../lib/figureCheck.js";

const base = numberBase(["Chiffre d'affaires : 2,4 millions d'euros, hausse de 6 %.", "Effectif 17 personnes. 1 250 000 pièces. https://x.fr/2024/99", "#top50", "11 collaborateurs et 3 ans d'expérience."]);

test("les chiffres fournis ne sont pas signalés, quel que soit leur format", () => {
  assert.deepEqual(figuresToCheck("2,4 millions, +6 % et 17 personnes, 1.250.000 pièces.", base), []);
  assert.deepEqual(figuresToCheck("hausse de 6% ; 6 pour cent", base), []);
});
test("un chiffre absent des informations est signalé avec son unité", () => {
  assert.deepEqual(figuresToCheck("Résultat : +42 % de leads en 3 mois.", base), ["42 %", "3 mois"]);
  assert.deepEqual(figuresToCheck("On compte 38 salariés.", base), ["38 salariés"]);
});
test("même nombre mais autre unité : signalé (« 11 mois » n'est pas « 11 collaborateurs »)", () => {
  assert.deepEqual(figuresToCheck("En 11 mois, 3 années de travail.", base), ["11 mois"]);
  assert.deepEqual(figuresToCheck("11 collaborateurs, 3 ans.", base), []);
  assert.deepEqual(figuresToCheck("11 collaborateur et 3 années", base), []);
});
test("numérotation de structure, années, adresses et hashtags ne sont pas signalés", () => {
  assert.deepEqual(figuresToCheck("Voici 3 conseils et 5 erreurs. En 2026, rien ne change. https://z.fr/777 #top77", base), []);
});
test("sans base, ou avec une base de serveur plus ancien (clés seules), le comportement reste sûr", () => {
  assert.deepEqual(figuresToCheck("42 %", undefined), []);
  assert.deepEqual(figuresToCheck("En 11 mois, +42 %", ["11", "6"]), ["42 %"]);
});
