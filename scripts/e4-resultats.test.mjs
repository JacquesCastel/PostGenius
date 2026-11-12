// Test du script de résultats E4 avec une clé et des grilles FICTIVES. Ne lit jamais la vraie clé d'anonymisation.
// Lancer : node --test scripts/e4-resultats.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toCsv } from "./e4-compare.mjs";
import { check, computePerText, byCondition, pairedDiff, decide, readFinalElements, readFinalTextes, run, SUJETS_SANS_CHIFFRE } from "./e4-resultats.mjs";

const CONDS = ["A", "B", "C", "D", "AN", "BN", "CN"];
const SUBJ = Array.from({ length: 10 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);
const fakeKey = () => CONDS.flatMap((c, ci) => SUBJ.map((s, si) => ({ id: `T-${ci}-${si}`, condition: c, subject: s })));
// perText fictif : counts[cond] = tableau de 10 valeurs I+X+D
const mkPerText = (counts, ixOnly = {}) => CONDS.flatMap((c) => SUBJ.map((s, i) => ({ id: `${c}-${s}`, condition: c, subject: s, F: 0, D: 0, I: counts[c]?.[i] ?? 0, V: 0, X: 0, G: 0, nonSupportes: counts[c]?.[i] ?? 0, refus: false, absent: false, ixSeul: ixOnly[c]?.[i] ?? counts[c]?.[i] ?? 0 })));
const rep = (v) => Array(10).fill(v);
const l14 = (d) => d.lines.filter((l) => l.ligne <= 4).map((l) => l.ligne);   // lignes 1 à 4 (C / B / D) ; les lignes 5 et 6 sont indépendantes

test("moyenne, total et part de posts avec au moins un élément non supporté", () => {
  const cond = byCondition(mkPerText({ B: [0, 0, 0, 0, 0, 0, 0, 0, 5, 5], C: rep(0) }));
  assert.equal(cond.B.moyenne, 1);
  assert.equal(cond.B.total, 10);
  assert.equal(cond.B.avec1, 2);
  assert.equal(cond.B.partAvec1, 0.2);
  assert.equal(cond.C.total, 0);
});

test("règle 2 : C ≈ B (écart ≤ 1) ; règle 1 : C pire de plus de 1", () => {
  let d = decide(byCondition(mkPerText({ B: rep(3), C: rep(3.5), D: rep(3) })), []);
  assert.deepEqual(l14(d), [2]);
  d = decide(byCondition(mkPerText({ B: rep(3), C: rep(4.5), D: rep(3) })), []);
  assert.deepEqual(l14(d), [1]);
  d = decide(byCondition(mkPerText({ B: rep(3), C: rep(2.5), D: rep(3) })), []);
  assert.deepEqual(l14(d), [2], "C meilleur de 0,5 seulement : équivalent");
});

test("règles 3 et 4 : C nettement meilleur (≥ 2), selon D", () => {
  let d = decide(byCondition(mkPerText({ B: rep(5), C: rep(2), D: rep(5) })), []);
  assert.deepEqual(l14(d), [3]);
  d = decide(byCondition(mkPerText({ B: rep(5), C: rep(2), D: rep(2.5) })), []);
  assert.deepEqual(l14(d), [4]);
});

test("cas non couverts par le protocole : signalés, jamais tranchés en silence", () => {
  let d = decide(byCondition(mkPerText({ B: rep(5), C: rep(3.5), D: rep(5) })), []);   // B − C = 1,5
  assert.equal(d.lines.filter((l) => l.ligne <= 4).length, 0);
  assert.match(d.notes.join(" "), /ni « ≈ » ni « nettement »/);
  d = decide(byCondition(mkPerText({ B: rep(5), C: rep(2), D: rep(3.5) })), []);       // C net, D intermédiaire
  assert.equal(d.lines.filter((l) => l.ligne <= 4).length, 0);
  assert.match(d.notes.join(" "), /aucune ligne du protocole ne s'applique pour D/);
  d = decide(byCondition(mkPerText({ B: rep(5), C: rep(2), D: rep(7) })), []);          // D pire que B
  assert.match(d.notes.join(" "), /D est pire que B/);
});

test("règle 5 : I ou X en C sur les sujets 3, 5, 10 ; règle 6 : zéro partout en C", () => {
  const c = rep(0); c[2] = 1; c[4] = 2;                                                  // S03 et S05
  let d = decide(byCondition(mkPerText({ B: rep(1), C: c, D: rep(1) })), []);
  const l5 = d.lines.find((l) => l.ligne === 5);
  assert.ok(l5); assert.match(l5.phrase, /dans 2 cas sur 3/); assert.match(l5.detail, /S03, S05/);
  assert.equal(d.lines.find((l) => l.ligne === 6), undefined);
  d = decide(byCondition(mkPerText({ B: rep(1), C: rep(0), D: rep(1) })), []);
  assert.ok(d.lines.find((l) => l.ligne === 6));
  assert.equal(d.lines.find((l) => l.ligne === 5), undefined);
});

test("la ligne 5 compte I et X seulement, pas D", () => {
  const c = rep(1);                                  // 1 élément non supporté partout, mais déformé (D) : ixSeul = 0
  const d = decide(byCondition(mkPerText({ B: rep(1), C: c, D: rep(1) }, { C: rep(0) })), []);
  assert.equal(d.lines.find((l) => l.ligne === 5), undefined);
});

test("écarts par paires de sujets", () => {
  const p = pairedDiff(mkPerText({ B: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], C: [1, 3, 5, 3, 3, 3, 3, 3, 3, 3] }), "C", "B");
  assert.equal(p.moyenne, 0);
  assert.equal(p.moins, 1); assert.equal(p.plus, 1); assert.equal(p.egal, 8);
  assert.equal(p.min, -2); assert.equal(p.max, 2);
});

test("contrôles : un code final vide ou invalide bloque le calcul", () => {
  const key = fakeKey();
  const textes = Object.fromEntries(key.map((k) => [k.id, { id: k.id, sujet: k.subject, refus: "non", absent: SUJETS_SANS_CHIFFRE.includes(k.subject) ? "non" : "sans objet" }]));
  const ok = check([{ id: key[0].id, n: "1", element: "x", code: "I" }], textes, key);
  assert.deepEqual(ok, []);
  assert.match(check([{ id: key[0].id, n: "1", element: "x", code: "" }], textes, key).join(), /code final vide/);
  assert.match(check([{ id: key[0].id, n: "1", element: "x", code: "Z" }], textes, key).join(), /invalide/);
  assert.match(check([], { ...textes, [key[0].id]: { ...textes[key[0].id], refus: "" } }, key).join(), /refus/);
});

test("ECART exclut un élément, sensibilité exclut les étiquettes demandées", () => {
  const key = [{ id: "T-AAAA", condition: "B", subject: "S05" }];
  const els = [{ id: "T-AAAA", code: "I", etiquette: "" }, { id: "T-AAAA", code: "I", etiquette: "CONSEIL" }, { id: "T-AAAA", code: "I", etiquette: "ECART" }, { id: "T-AAAA", code: "ECART", etiquette: "" }, { id: "T-AAAA", code: "F", etiquette: "" }];
  const t = { "T-AAAA": { refus: "non", absent: "oui" } };
  assert.equal(computePerText(els, t, key)[0].nonSupportes, 3);
  assert.equal(computePerText(els, t, key, { sansEtiquettes: ["conseil"] })[0].nonSupportes, 2);
});

test("de bout en bout sur fichiers fictifs : écrit résultats.md et le détail par texte", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e4res-"));
  const key = fakeKey();
  fs.writeFileSync(path.join(dir, "cle.json"), JSON.stringify(key));
  const els = key.flatMap((k) => (k.condition === "B" ? [[k.id, "1", "x", "chiffre", "I", "accord", "I", "I", "", ""]] : []));
  fs.writeFileSync(path.join(dir, "el.csv"), toCsv([["id_texte", "n", "élément", "type", "code final (F/D/I/V/X/G ou ECART)", "origine", "code assistant", "code Jacques", "motif", "étiquette"], ...els]));
  fs.writeFileSync(path.join(dir, "tx.csv"), toCsv([["id_texte", "sujet", "refus_ou_pas_de_donnee (oui/non)", "chiffre_absent_de_la_fiche (oui/non/sans objet)", "origine"], ...key.map((k) => [k.id, k.subject, "non", SUJETS_SANS_CHIFFRE.includes(k.subject) ? "non" : "sans objet", "accord"])]));
  const r = run({ elements: path.join(dir, "el.csv"), textes: path.join(dir, "tx.csv"), cle: path.join(dir, "cle.json"), desaccords: path.join(dir, "nope.csv"), out: path.join(dir, "out"), sans: [] });
  assert.deepEqual(r.problems, []);
  assert.equal(r.cond.B.moyenne, 1);
  assert.equal(r.cond.C.moyenne, 0);
  assert.ok(r.decision.lines.find((l) => l.ligne === 6), "C vaut 0 partout : ligne 6");
  const md = fs.readFileSync(path.join(dir, "out/resultats.md"), "utf8");
  assert.match(md, /Critère principal par condition/);
  assert.match(md, /Tableau complet/);
  assert.ok(fs.existsSync(path.join(dir, "out/detail-par-texte.csv")));
  assert.equal(readFinalElements(fs.readFileSync(path.join(dir, "el.csv"), "utf8")).length, 10);
  assert.equal(Object.keys(readFinalTextes(fs.readFileSync(path.join(dir, "tx.csv"), "utf8"))).length, 70);
});
