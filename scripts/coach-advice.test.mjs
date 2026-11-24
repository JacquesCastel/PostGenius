// Conseil du coach (lib/coachAdvice.js) : avec peu de posts (confiance « faible »), le conseil est une piste à tester, jamais une injonction ni une action directe.
// Au-delà, les textes sont exactement ceux d'avant. Lancer : node --test scripts/coach-advice.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { adviceFor, isTentative, actionLabel } from "../lib/coachAdvice.js";

const ins = (o) => ({ dimension: "format", key: "text", direction: "up", action: "create", confidence: "moyenne", n: 6, ...o });

test("confiance « moyenne » ou « bonne » : les textes d'avant, mot pour mot", () => {
  for (const confidence of ["moyenne", "bonne"]) {
    assert.equal(adviceFor(ins({ confidence })), "Écrivez-en davantage.");
    assert.equal(adviceFor(ins({ confidence, direction: "down" })), "À retravailler, ou à espacer.");
    assert.equal(adviceFor(ins({ confidence, action: "slot" })), "Programmez vos prochains posts à ce moment.");
    assert.equal(adviceFor(ins({ confidence, action: "slot", direction: "down" })), "Évitez ce moment pour vos posts importants.");
    assert.equal(adviceFor(ins({ confidence, action: "firstcomment", key: "yes", direction: "up" })), "Chez vous, un lien dans le texte ne freine pas la portée.");
    assert.equal(adviceFor(ins({ confidence, action: "firstcomment", key: "yes", direction: "down" })), "Mettez plutôt le lien en premier commentaire : la portée est meilleure sans lien dans le texte.");
    assert.equal(adviceFor(ins({ confidence, action: "firstcomment", key: "no", direction: "up" })), "Gardez le lien pour le premier commentaire.");
    assert.equal(adviceFor(ins({ confidence, action: "firstcomment", key: "no", direction: "down" })), "Un post sans lien fait moins bien chez vous : testez avec le lien dans le texte.");
  }
});
test("confiance « faible » : piste à tester ou à surveiller, écart « à confirmer », aucune injonction", () => {
  for (const action of ["create", "slot", "firstcomment"]) for (const direction of ["up", "down"]) {
    const t = adviceFor(ins({ confidence: "faible", n: 3, action, direction, key: "yes" }));
    assert.match(t, direction === "up" ? /^À tester sur vos prochains posts/ : /^À surveiller/, `${action}/${direction} : ${t}`);
    assert.match(t, /à confirmer/);
    assert.ok(!/Écrivez|Programmez|Évitez|Mettez|Gardez|retravailler|testez avec/i.test(t), `injonction : ${t}`);
  }
});
test("pas d'action directe quand le constat est fragile ; le bouton est conservé sinon", () => {
  assert.equal(isTentative(ins({ confidence: "faible" })), true);
  assert.equal(isTentative(ins({ confidence: "moyenne" })), false);
  assert.equal(isTentative(ins({ confidence: "bonne" })), false);
  assert.equal(isTentative(ins({ confidence: undefined })), false, "confiance inconnue : comportement d'avant");
  assert.equal(actionLabel(ins({ action: "slot" })), "Voir le planning");
  assert.equal(actionLabel(ins({ action: "create" })), "Créer un post");
  assert.equal(actionLabel(ins({ action: "firstcomment" })), "Créer un post");
});
test("l'écran utilise ces fonctions : conseil prudent et bouton masqué pour un constat fragile", () => {
  const src = fs.readFileSync("app/app/page.js", "utf8");
  assert.ok(src.includes('from "@/lib/coachAdvice"') && src.includes("adviceFor(i)") && src.includes("isTentative(i)"));
  assert.ok(!src.includes('return i.direction === "up" ? "Écrivez-en davantage." : "À retravailler, ou à espacer.";'), "plus de texte en dur dans l'écran");
  assert.ok(/!isTentative\(i\) &&/.test(src), "bouton d'action masqué quand le constat est fragile");
});
