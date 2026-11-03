// Non-régression du moteur B : le moteur A (comportement par défaut) ne change pas, B ne diffère que par ses trois remplacements,
// et le champ « advisory » reste optionnel. Lancer : node --test scripts/engine-b.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { writingRulesPrompt, WHY_INSTRUCTION, ANTI_INVENTION_INSTRUCTION, FACT_BOUNDARY_INSTRUCTION, cleanAdvisory } from "../lib/linkedinRules.js";

const h = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

test("moteur A inchangé : empreintes des prompts relevées avant la modification", () => {
  assert.equal(h(writingRulesPrompt(1300)), "e99f7b0ce00264fb");
  assert.equal(h(writingRulesPrompt(2200)), "d2eac1ba7143e445");
  assert.equal(h(writingRulesPrompt()), "d2eac1ba7143e445");
  assert.equal(h(WHY_INSTRUCTION), "17cb2eca8152608d");
  assert.equal(h(ANTI_INVENTION_INSTRUCTION), "7f1896b6790c5b64");
});

test("moteur B : ne diffère de A que par la consigne du corps et le garde-fou factuel", () => {
  const a = writingRulesPrompt(1300);
  const b = writingRulesPrompt(1300, { factBoundary: true });
  const body = (t) => t.replace(/- CORPS : développe cette idée \([^)]*\) puis/, "- CORPS : développe cette idée (X) puis");
  const rebuilt = body(a).replace(ANTI_INVENTION_INSTRUCTION, "G");
  assert.equal(body(b).replace(FACT_BOUNDARY_INSTRUCTION, "G"), rebuilt);
  assert.ok(!b.includes("une preuve, un exemple concret"));
  assert.ok(b.includes("RIGUEUR FACTUELLE") && b.includes("FAITS DOCUMENTÉS") && b.includes("INTERPRÉTATIONS") && b.includes("INFORMATIONS MANQUANTES"));
});

test("moteur B : la priorité du profil sur les règles et la voix de l'auteur sont conservées", () => {
  const b = writingRulesPrompt(1300, { factBoundary: true });
  assert.ok(b.includes("c'est l'auteur qui a raison"));
  assert.ok(b.includes("PYRAMIDE INVERSÉE"));
  assert.ok(b.includes("Zéro émoji est un choix tout aussi valable"));
  assert.ok(b.includes("Garde une position claire et engagée"), "la rigueur ne doit pas devenir de la neutralité");
});

test("advisory : trois états, champs bornés, jamais obligatoire", () => {
  assert.equal(cleanAdvisory(undefined), null);
  assert.equal(cleanAdvisory({ status: "inconnu" }), null);
  assert.equal(cleanAdvisory("ready"), null);
  assert.deepEqual(cleanAdvisory({ status: "ready" }), { status: "ready", issue: "", toClarify: [], recommendation: "" });
  const a = cleanAdvisory({ status: "blocked", issue: " Deux chiffres se contredisent. ", toClarify: ["a", "b", "c", "d", "e", "", 3], recommendation: "x".repeat(500) });
  assert.equal(a.status, "blocked");
  assert.equal(a.issue, "Deux chiffres se contredisent.");
  assert.deepEqual(a.toClarify, ["a", "b", "c", "d"]);
  assert.equal(a.recommendation.length, 300);
});

test("route : B n'est actif que par EDITORIAL_ENGINE=B et advisory n'est ajouté que s'il est valide", () => {
  const src = fs.readFileSync(new URL("../app/api/generate/route.js", import.meta.url), "utf8");
  assert.ok(src.includes('process.env.EDITORIAL_ENGINE === "B"'));
  assert.ok(src.includes("...(advisory ? { advisory } : {})"));
  assert.ok(src.includes("engineB && !params.refine?.text ? cleanAdvisory(result.advisory) : null;"));
  // le contrat existant reste présent, dans le même ordre
  assert.ok(src.includes("text: result.text, extra:") && src.includes("why: cleanWhy(result.why, result.text), sources: usedSources("));
});
