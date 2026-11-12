// Test du script de comparaison E4 avec des grilles fictives (aucune donnée réelle, aucune clé). Lancer : node --test scripts/e4-compare.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseCsv, toCsv, tokens, similarity, matchElements, kappa, compare, readElements, readTextes, run } from "./e4-compare.mjs";

const el = (id, element, code, type = "chiffre") => ({ id, n: "1", element, type, code, ligne: "", recherche: "", source: "", comment: "", who: "x" });

test("CSV : point-virgule, guillemets, BOM, retour à la ligne dans un champ", () => {
  const rows = parseCsv("﻿a;b;c\n1;\"x;y\";\"l1\nl2\"\n");
  assert.deepEqual(rows, [["a", "b", "c"], ["1", "x;y", "l1\nl2"]]);
  assert.deepEqual(parseCsv(toCsv([["a", "x;y", 'q"q']])), [["a", "x;y", 'q"q']]);
});

test("jetons : séparateurs de milliers, virgule décimale, accents", () => {
  assert.deepEqual([...tokens("1 450 € HT par personne").nums], ["1450"]);
  assert.deepEqual([...tokens("2,4 millions d’euros").nums], ["2.4"]);
  assert.ok(tokens("Étienne Faure").words.has("etienne"));
});

test("similarité : même élément reformulé, nombres différents jamais appariés", () => {
  assert.ok(similarity("71 %", "71 % des répondants") >= 0.9);
  assert.ok(similarity("Nadia Sorel", "Nadia Sorel, consultante RH indépendante") >= 0.9);
  assert.equal(similarity("18 retards par mois", "7 retards par mois"), 0);
  assert.equal(similarity("380 000 €", "9 jours"), 0);
  assert.ok(similarity("12 mars 2027", "première session le 12 mars 2027") >= 0.9);
});

test("appariement un-à-un : éléments communs, restes signalés", () => {
  const A = [el("T-AAAA", "71 % des répondants", "F"), el("T-AAAA", "64 salariés", "F"), el("T-AAAA", "Groupe Almeri", "F")];
  const B = [el("T-AAAA", "Groupe Almeri", "F"), el("T-AAAA", "71 %", "F"), el("T-AAAA", "environ 45 personnes", "I")];
  const m = matchElements(A, B);
  assert.equal(m.matched.length, 2);
  assert.deepEqual(m.onlyA.map((e) => e.element), ["64 salariés"]);
  assert.deepEqual(m.onlyB.map((e) => e.element), ["environ 45 personnes"]);
});

test("kappa : accord parfait = 1 ; désaccord total ≤ 0", () => {
  const p = (a, b) => ({ a: { code: a }, b: { code: b } });
  assert.equal(kappa([p("F", "F"), p("I", "I"), p("D", "D")]), 1);
  assert.ok(kappa([p("F", "I"), p("I", "F")]) <= 0);
});

test("comparaison : désaccords de code, d'élément, de refus ; aucun accord ne laisse de case vide", () => {
  const tx = (id, refus, absent) => ({ id, sujet: "S03", refus, absent, nb: "", remarques: "" });
  const A = [el("T-AAAA", "18 mois", "I"), el("T-AAAA", "Lucas Perrin", "F"), el("T-BBBB", "48 heures", "I")];
  const B = [el("T-AAAA", "18 mois", "V"), el("T-AAAA", "Lucas Perrin", "F"), el("T-BBBB", "48 heures", "I"), el("T-BBBB", "3 semaines", "I")];
  const r = compare({ elA: A, elB: B, txA: { "T-AAAA": tx("T-AAAA", "oui", "oui"), "T-BBBB": tx("T-BBBB", "non", "oui") }, txB: { "T-AAAA": tx("T-AAAA", "oui", "oui"), "T-BBBB": tx("T-BBBB", "non", "non") } });
  assert.equal(r.stats.appariés, 3);
  assert.equal(r.stats.codeDiff, 1);
  assert.equal(r.stats.seulJacques, 1);
  assert.deepEqual(r.stats.desaccordsParType, { "code différent": 1, "relevé par Jacques seul": 1, "chiffre absent différent": 1 });
  assert.equal(r.stats.desaccordsTotal, 3);
  const accords = r.finalEls.filter((e) => e.origine === "accord");
  assert.ok(accords.length === 2 && accords.every((e) => e.code));
  assert.ok(r.finalEls.filter((e) => e.origine !== "accord").every((e) => e.code === ""));
  assert.equal(r.perText.find((t) => t.id === "T-AAAA").unsA, 1);
  assert.equal(r.perText.find((t) => t.id === "T-AAAA").unsB, 0);
});

test("de bout en bout sur fichiers : les vraies grilles de l'assistant comparées à elles-mêmes = accord total, 70 textes", () => {
  const d = new URL("../docs/e4-chiffres/classement/", import.meta.url).pathname;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "e4cmp-"));
  const { res, problems } = run({ ce: d + "grille-elements-claude.csv", je: d + "grille-elements-claude.csv", ct: d + "grille-textes-claude.csv", jt: d + "grille-textes-claude.csv", out, seuil: 0.6 });
  assert.deepEqual(problems, []);
  assert.equal(res.stats.textes, 70);
  assert.equal(res.stats.elementsClaude, 287);
  assert.equal(res.stats.desaccordsTotal, 0);
  assert.equal(res.stats.appariés, 287);
  for (const f of ["rapport-comparaison.md", "desaccords.csv", "grille-elements-finale.csv", "grille-textes-finale.csv"]) assert.ok(fs.existsSync(path.join(out, f)), f);
});

test("validation : code invalide et texte manquant sont signalés", () => {
  const e = readElements("id_texte;n;element;type;code\nT-AAAA;1;x;chiffre;Z\n", "Jacques");
  assert.equal(e.problems.length, 1);
  const t = readTextes("id_texte;sujet;refus\nT-AAAA;S01;peut-être\n", "Jacques");
  assert.equal(t.problems.length, 1);
});
