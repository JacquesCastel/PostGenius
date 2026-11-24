// Qualification d'un post à partir de ce qui existe déjà (lib/qualification.js) : objectif normalisé avec sa provenance. Lancer : node --test scripts/qualification.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeObjective, qualifyObjective, objectiveCoverage, OBJECTIVES } from "../lib/qualification.js";

test("objectif : texte libre ramené à une catégorie (la première évoquée l'emporte)", () => {
  const cases = [
    ["Faire connaître la méthode et générer des demandes", "notoriété"],
    ["Générer des demandes de rendez-vous", "leads"],
    ["Leads qualifiés (objectif principal), notoriété (secondaire)", "leads"],
    ["Notoriété de la marque employeur", "notoriété"],
    ["Recruter des candidats ingénieurs", "recrutement"],
    ["Marque employeur", "recrutement"],
    ["Démontrer notre expertise", "expertise"],
    ["Asseoir l'autorité sur le sujet", "expertise"],
    ["Visibilité", "notoriété"],
    ["Prospects et inscriptions au webinaire", "leads"],
  ];
  for (const [text, expected] of cases) assert.equal(normalizeObjective(text), expected, text);
});
test("objectif : texte sans mot reconnu = « autre » ; vide ou absent = non qualifié", () => {
  assert.equal(normalizeObjective("Faire plaisir à la direction"), "autre");
  for (const v of [null, undefined, "", "   ", 5]) assert.equal(normalizeObjective(v), null);
  assert.ok(OBJECTIVES.includes("autre"));
});
test("accents et casse sans importance", () => {
  assert.equal(normalizeObjective("NOTORIETE"), "notoriété");
  assert.equal(normalizeObjective("Génération de LEADS"), "leads");
});
test("provenance : le plan de campagne prime sur la campagne, puis sur la proposition ; chaque valeur dit d'où elle vient", () => {
  const q1 = qualifyObjective({ campaignPost: { objective: "Générer des leads" }, campaign: { objective: "Notoriété" }, editorialReco: { objective: "expertise" } });
  assert.deepEqual(q1, { value: "leads", provenance: "plan de campagne" });
  assert.deepEqual(qualifyObjective({ campaignPost: { objective: "" }, campaign: { objective: "Notoriété" } }), { value: "notoriété", provenance: "campagne" });
  assert.deepEqual(qualifyObjective({ editorialReco: { objective: "recrutement" } }), { value: "recrutement", provenance: "proposition « Que publier ? »" });
  assert.equal(qualifyObjective({}), null);
  assert.equal(qualifyObjective({ campaignPost: null, campaign: null, editorialReco: null }), null);
});
test("couverture : part des posts qualifiés ; la dimension ne sert qu'à partir de la moitié et de deux valeurs différentes", () => {
  const rows = (...vals) => vals.map((o, i) => ({ id: `p${i}`, objective: o }));
  assert.deepEqual(objectiveCoverage(rows("leads", "leads", null, null)), { qualified: 2, total: 4, share: 0.5, distinct: 1, usable: false }, "une seule valeur : rien à comparer");
  assert.equal(objectiveCoverage(rows("leads", "notoriété", null, null)).usable, true);
  assert.equal(objectiveCoverage(rows("leads", "notoriété", null, null, null)).usable, false, "40 % : insuffisant");
  assert.equal(objectiveCoverage([]).usable, false);
});
