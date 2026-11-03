// Tests de B2b : A, B et B2 restent identiques ; l'audit est un auto-contrôle ; advisory piloté en code ; consignes condensées.
// Lancer : node --test scripts/engine-b2b.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { writingRulesPrompt, FACT_BOUNDARY_B2, ANALYSIS_INSTRUCTION_B2, ADVISORY_INSTRUCTION_B2, FACT_BOUNDARY_B2B, ANALYSIS_INSTRUCTION_B2B, AUDIT_INSTRUCTION_B2B, ADVISORY_INSTRUCTION_B2B, cleanAudit, cleanAnalysisB2b, finalizeAdvisoryB2b, isReassuring } from "../lib/linkedinRules.js";

const h = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const TEXT = "Un outil est déployé dans un atelier. Les équipes demandent plus de formation. Nous préférons avancer prudemment.";

test("A, B et B2 inchangés par l'ajout de B2b (empreintes relevées avant B2b)", () => {
  assert.equal(h(writingRulesPrompt(1300)), "e99f7b0ce00264fb");
  assert.equal(h(writingRulesPrompt(1300, { factBoundary: true })), "56497f4d3c0b48d8");
  assert.equal(h(writingRulesPrompt(1300, { factBoundary: "B2" })), "3ce6f25e635225d0");
  assert.equal(h(writingRulesPrompt(2200, { factBoundary: "B2" })), "b489215d16042527");
  assert.equal(h(FACT_BOUNDARY_B2), "d0139313c94e70c9");
  assert.equal(h(ANALYSIS_INSTRUCTION_B2), "ec510c2ac77ae208");
  assert.equal(h(ADVISORY_INSTRUCTION_B2), "f58022447bcf4b86");
});

test("B2b : consignes de fond nettement plus courtes que B2", () => {
  const b2 = FACT_BOUNDARY_B2.length + ANALYSIS_INSTRUCTION_B2.length + ADVISORY_INSTRUCTION_B2.length;
  const b2b = FACT_BOUNDARY_B2B.length + ANALYSIS_INSTRUCTION_B2B.length + AUDIT_INSTRUCTION_B2B.length + ADVISORY_INSTRUCTION_B2B.length;
  assert.ok(b2b <= 0.7 * b2, `${b2b} contre ${b2}`);
});

test("B2b : contenu des règles (rôle de l'auteur, missing contraignant, voix conservée)", () => {
  const p = writingRulesPrompt(1300, { factBoundary: "B2b" });
  assert.ok(p.includes(FACT_BOUNDARY_B2B));
  assert.ok(p.includes("MISSING — ce que tu y listes reste inconnu dans le texte"));
  assert.ok(p.includes("Convictions, posture et pratiques habituelles du profil : première personne permise"));
  assert.ok(p.includes("Une opposition d'idées n'est pas une contradiction"));
  assert.ok(p.includes("c'est l'auteur qui a raison") && p.includes("PYRAMIDE INVERSÉE"));
  assert.ok(p.includes("La rigueur porte sur les faits, pas sur la conviction"));
  assert.ok(!p.includes("une preuve, un exemple concret"));
});

test("audit : citations vérifiées dans le texte, hypothèses séparées des affirmations", () => {
  const a = cleanAudit({ unsupported: [{ quote: "Nous préférons avancer prudemment", why: "intention non fournie" }, { quote: "phrase absente du texte", why: "?" }], hypotheses: ["peut-être"] }, TEXT);
  assert.equal(a.unsupported[0].found, true);
  assert.equal(a.unsupported[1].found, false, "une citation absente du texte est signalée");
  assert.deepEqual(a.hypotheses, ["peut-être"]);
  assert.equal(cleanAudit(undefined, TEXT), null);
  assert.equal(cleanAudit({ unsupported: "x" }, TEXT), null);
  assert.equal(cleanAudit({ unsupported: [1, 2, 3, 4, 5, 6].map((i) => ({ quote: `q${i}`, why: "w" })) }, TEXT).unsupported.length, 4);
});

test("advisory B2b : une affirmation non étayée impose « verify » même si le modèle dit « ready »", () => {
  const r = finalizeAdvisoryB2b({ status: "ready" }, { missing: [], contradictions: [] }, { unsupported: [{ quote: "Nous préférons avancer prudemment", why: "intention" }], hypotheses: [] }, TEXT);
  assert.equal(r.advisory.status, "verify");
  assert.ok(r.advisory.toClarify[0].startsWith("Confirmer ou retirer"));
  assert.ok(/non indépendant/.test(r.advisory.issue), "l'audit n'est jamais présenté comme une vérification indépendante");
  assert.equal(r.guard.raised, true);
});

test("advisory B2b : contradiction centrale → blocked, jamais de recommandation rassurante", () => {
  const r = finalizeAdvisoryB2b({ status: "verify", issue: "x", toClarify: [], recommendation: "En l'état, le post reste publiable." }, { contradictions: ["-20 % contre aucune évolution"] }, { unsupported: [] }, TEXT);
  assert.equal(r.advisory.status, "blocked");
  assert.ok(!isReassuring(r.advisory.recommendation));
  assert.equal(r.guard.reassuringReplaced, true);
});

test("advisory B2b : ready seulement sans aucune anomalie ; les hypothèses assumées ne comptent pas", () => {
  const ok = finalizeAdvisoryB2b({ status: "ready" }, { missing: ["x"], contradictions: [], regulatory: false }, { unsupported: [], hypotheses: ["cela suggère…"] }, TEXT);
  assert.equal(ok.advisory.status, "ready");
  assert.equal(finalizeAdvisoryB2b({ status: "ready" }, { regulatory: true }, { unsupported: [] }, TEXT).advisory.status, "verify");
});

test("advisory B2b : audit absent → au moins « verify » (un texte non audité n'est pas « ready »)", () => {
  const r = finalizeAdvisoryB2b({ status: "ready" }, { missing: [], contradictions: [] }, undefined, TEXT);
  assert.equal(r.advisory.status, "verify");
  assert.equal(r.guard.auditMissing, true);
  assert.ok(/indisponible/.test(r.advisory.issue));
});

test("advisory B2b : réglementaire → actualité signalée ; statut du modèle jamais abaissé ; rien du tout → null", () => {
  const reg = finalizeAdvisoryB2b({ status: "ready" }, { regulatory: true }, { unsupported: [] }, TEXT);
  assert.ok(reg.advisory.toClarify.some((x) => /statut et la date actuels/.test(x)));
  assert.equal(finalizeAdvisoryB2b({ status: "blocked", issue: "i", toClarify: [], recommendation: "r" }, { contradictions: [] }, { unsupported: [] }, TEXT).advisory.status, "blocked");
  assert.deepEqual(finalizeAdvisoryB2b(undefined, undefined, undefined, TEXT), { advisory: null, analysis: null, audit: null, guard: null });
  assert.deepEqual(cleanAnalysisB2b({ missing: ["a"], contradictions: [], regulatory: "oui" }), { missing: ["a"], contradictions: [], regulatory: false });
});

test("route : B2b par EDITORIAL_ENGINE=B2b, un seul appel, audit visible seulement en debug", () => {
  const src = fs.readFileSync(new URL("../app/api/generate/route.js", import.meta.url), "utf8");
  assert.ok(src.includes('process.env.EDITORIAL_ENGINE === "B2b"'));
  assert.ok(src.includes("finalizeAdvisoryB2b(result.advisory, result.analysis, result.audit, result.text)"));
  assert.ok(src.includes('process.env.EDITORIAL_DEBUG === "1" ? { analysis: finalB2.analysis, ...(finalB2.audit'));
  assert.equal((src.match(/fetch\("https:\/\/api\.anthropic\.com\/v1\/messages"/g) ?? []).length, 1, "un seul appel IA");
  assert.ok(src.includes('"text": "le post complet", ${engineB2b ?'), "l'audit suit le texte dans le format JSON");
});
