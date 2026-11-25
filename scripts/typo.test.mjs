// Liaisons typographiques des titres (lib/typo.js). Lancer : node --test scripts/typo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { liaisons, NB } from "../lib/typo.js";

const show = (s) => s.split(NB).join("~");

test("un mot court reste lié au suivant", () => {
  assert.equal(show(liaisons("Un outil qui préfère montrer ses limites", { fin: false })), "Un~outil qui~préfère montrer ses~limites");
});
test("les expressions ne se coupent pas", () => {
  assert.equal(show(liaisons("Une note de mise en forme, pas une prédiction.", { fin: false })), "Une~note de~mise~en~forme, pas~une~prédiction.");
  assert.equal(show(liaisons("Ce que la note ne dit pas", { fin: false })), "Ce~que~la~note ne~dit~pas");
});
test("la ponctuation haute et les guillemets restent collés", () => {
  assert.equal(show(liaisons("Le contrôle : voir « plus » ?", { fin: false })), "Le~contrôle~: voir «~plus~»~?");
});
test("les deux derniers mots ne se séparent pas, sauf si on le demande", () => {
  assert.equal(show(liaisons("Trois gestes, vous gardez la main.")), "Trois gestes, vous gardez la~main.");
  assert.equal(show(liaisons("Notre manière de prouver")), "Notre manière de~prouver");
  assert.equal(liaisons("Le blog"), `Le${NB}blog`);
  assert.equal(show(liaisons("Vos sources", { fin: false })), "Vos~sources");
});
test("idempotent, et sans effet sur un texte vide ou sans espace", () => {
  const t = liaisons("Ce que nous avons mesuré, et rien de plus.");
  assert.equal(liaisons(t), t);
  assert.equal(liaisons(""), "");
  assert.equal(liaisons(null), "");
  assert.equal(liaisons("Blog"), "Blog");
});
test("jamais d'espace ordinaire avant : ; ? ! ni après un guillemet ouvrant", () => {
  const t = liaisons("Voici : la question ? Oui ! « Bien » ; fin.");
  assert.doesNotMatch(t, / [:;?!»]/);
  assert.doesNotMatch(t, /« /);
});
