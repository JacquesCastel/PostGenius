// Tests de B2 : A et B restent identiques, le classement pilote advisory, aucune recommandation rassurante hors « ready ».
// Lancer : node --test scripts/engine-b2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { writingRulesPrompt, ADVISORY_INSTRUCTION, FACT_BOUNDARY_INSTRUCTION, ADVISORY_JSON_FORMAT, FACT_BOUNDARY_B2, ANALYSIS_INSTRUCTION_B2, cleanAnalysis, finalizeAdvisoryB2, isReassuring } from "../lib/linkedinRules.js";

const h = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

test("A et B inchangés par l'ajout de B2 (empreintes relevées avant B2)", () => {
  assert.equal(h(writingRulesPrompt(1300)), "e99f7b0ce00264fb");
  assert.equal(h(writingRulesPrompt(2200)), "d2eac1ba7143e445");
  assert.equal(h(writingRulesPrompt(1300, { factBoundary: true })), "56497f4d3c0b48d8");
  assert.equal(h(writingRulesPrompt(2200, { factBoundary: true })), "de7416818b4a0084");
  assert.equal(h(ADVISORY_INSTRUCTION), "759b923a6abab272");
  assert.equal(h(FACT_BOUNDARY_INSTRUCTION), "3496173a32215ad9");
  assert.equal(h(ADVISORY_JSON_FORMAT), "4a547a8fa6bcdfb8");
});

test("B2 : remplace le garde-fou, garde les règles de voix et de priorité du profil", () => {
  const p = writingRulesPrompt(1300, { factBoundary: "B2" });
  assert.ok(p.includes(FACT_BOUNDARY_B2));
  assert.ok(!p.includes("une preuve, un exemple concret"));
  assert.ok(p.includes("c'est l'auteur qui a raison") && p.includes("PYRAMIDE INVERSÉE"));
  assert.ok(p.includes("Garde une position claire et engagée"));
});

test("B2, R1 : la première personne reste permise pour convictions et pratiques habituelles, pas pour les actions du cas", () => {
  assert.ok(FACT_BOUNDARY_B2.includes("convictions, sa posture et ses pratiques habituelles documentées dans son profil"));
  assert.ok(FACT_BOUNDARY_B2.includes("aucune action que la demande ne dit pas explicitement qu'il a réalisée"));
});

test("B2, R2 : les interdits visés par la relecture sont nommés", () => {
  for (const mot of ["ancienneté", "engagement futur", "réaction de personnes", "faute prêtée à l'entreprise"]) assert.ok(FACT_BOUNDARY_B2.includes(mot), mot);
});

test("B2, R4 : une contradiction n'est pas une opposition d'idées", () => {
  assert.ok(FACT_BOUNDARY_B2.includes("Une opposition d'idées dans un raisonnement n'est pas une contradiction factuelle"));
});

test("B2, R5 : références réglementaires non complétées, références documentées utilisables", () => {
  assert.ok(FACT_BOUNDARY_B2.includes("ne complète jamais un brief avec des références que tu ne peux pas vérifier"));
  assert.ok(FACT_BOUNDARY_B2.includes("Une référence documentée dans la demande ou les sources peut être reprise"));
});

test("B2, R3 : classement court, non renvoyé par défaut", () => {
  for (const k of ["facts", "missing", "contradictions", "centralFactMissing", "regulatory"]) assert.ok(ANALYSIS_INSTRUCTION_B2.includes(k), k);
  const src = fs.readFileSync(new URL("../app/api/generate/route.js", import.meta.url), "utf8");
  assert.ok(src.includes('process.env.EDITORIAL_ENGINE === "B2"'));
  assert.ok(src.includes('finalB2 && process.env.EDITORIAL_DEBUG === "1" ? { analysis: finalB2.analysis,'), "analysis n'est renvoyé qu'en mode debug");
});

test("advisory B2 : une contradiction force « blocked », même si le modèle dit « verify »", () => {
  const r = finalizeAdvisoryB2({ status: "verify", issue: "i", toClarify: ["a"], recommendation: "Le post reste publiable." }, { contradictions: ["-20 % contre aucune évolution"], facts: [], missing: [] });
  assert.equal(r.advisory.status, "blocked");
  assert.ok(!isReassuring(r.advisory.recommendation), "jamais de recommandation rassurante avec blocked");
  assert.equal(r.guard.raised, true);
  assert.equal(r.guard.reassuringReplaced, true);
});

test("advisory B2 : fait central manquant ou sujet réglementaire imposent au moins « verify »", () => {
  assert.equal(finalizeAdvisoryB2({ status: "ready" }, { centralFactMissing: true }).advisory.status, "verify");
  const reg = finalizeAdvisoryB2({ status: "ready" }, { regulatory: true });
  assert.equal(reg.advisory.status, "verify");
  assert.ok(reg.advisory.toClarify.some((x) => /statut et la date actuels/.test(x)), "l'actualité des références est signalée");
});

test("advisory B2 : « ready » conservé quand rien ne s'y oppose (pas de prudence systématique)", () => {
  const r = finalizeAdvisoryB2({ status: "ready", issue: "", toClarify: [], recommendation: "" }, { facts: ["a"], missing: [], contradictions: [], centralFactMissing: false, regulatory: false });
  assert.deepEqual(r.advisory, { status: "ready", issue: "", toClarify: [], recommendation: "" });
});

test("advisory B2 : le statut du modèle n'est jamais abaissé par le classement", () => {
  assert.equal(finalizeAdvisoryB2({ status: "blocked", issue: "x", toClarify: [], recommendation: "y" }, { contradictions: [] }).advisory.status, "blocked");
});

test("advisory B2 : absent ou invalide -> null, champ optionnel", () => {
  assert.deepEqual(finalizeAdvisoryB2(undefined, undefined), { advisory: null, analysis: null, guard: null });
  assert.equal(finalizeAdvisoryB2({ status: "nimportequoi" }, null).advisory, null, "ni statut valide ni classement : aucun advisory inventé");
  assert.equal(finalizeAdvisoryB2({ status: "nimportequoi" }, { contradictions: ["a"] }).advisory.status, "blocked", "advisory invalide mais classement valide : le classement décide");
});

test("recommandations rassurantes : détectées, sauf négation", () => {
  assert.equal(isReassuring("Si l'auteur peut clarifier, le post gagnera ; en l'état, la formulation reste publiable."), true);
  assert.equal(isReassuring("Si oui, le post est solide."), true);
  assert.equal(isReassuring("Ce texte n'est pas publiable en l'état."), false);
  assert.equal(isReassuring("Ne publiez pas en l'état : clarifiez d'abord."), false);
});

test("classement : listes bornées, booléens stricts", () => {
  const a = cleanAnalysis({ facts: ["a", "b", "c", "d", "e", "f"], missing: ["x"], contradictions: ["c1", "c2", "c3"], centralFactMissing: "oui", regulatory: true });
  assert.equal(a.facts.length, 5);
  assert.equal(a.contradictions.length, 2);
  assert.equal(a.centralFactMissing, false);
  assert.equal(a.regulatory, true);
});
