// Liaisons typographiques des titres (lib/typo.js). Lancer : node --test scripts/typo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { liaisons, liaisonsEm, NB } from "../lib/typo.js";

const show = (s) => s.split(NB).join("~");

test("un mot court reste lié au suivant", () => {
  assert.equal(show(liaisons("Un outil qui préfère montrer ses limites", { fin: false })), "Un~outil qui~préfère montrer ses~limites");
});
test("les expressions ne se coupent pas", () => {
  assert.equal(show(liaisons("Une note de mise en forme, pas une prédiction.", { fin: false })), "Une~note de~mise~en~forme, pas~une~prédiction.");
  assert.equal(show(liaisons("Un indicateur de mise en forme, pas une boule de cristal", { fin: false })).includes("mise~en~forme"), true);
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

test("les titres du nouveau style passent par liaisons() (pages déjà portées)", async () => {
  const { readFileSync } = await import("node:fs");
  const lire = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  for (const [p, n] of [["app/contact/page.js", 1], ["app/beta/page.js", 2], ["app/blog/page.js", 3], ["app/blog/[slug]/page.js", 1], ["app/preuves/page.js", 4], ["app/preuves/test-e4/page.js", 7]]) {
    const s = lire(p);
    assert.match(s, /from "@\/lib\/typo"/, p);
    assert.ok((s.match(/liaisons\(/g) ?? []).length >= n, `${p} : au moins ${n} titres liés`);
    assert.doesNotMatch(s, / /, `${p} : pas d'espace insécable invisible dans le source (utiliser {NB})`);
  }
});

test("un bloc insécable trop long est coupé (il déborderait d'une colonne étroite)", () => {
  const long = (t, o) => Math.max(...liaisons(t, o).split(" ").map((b) => b.length));
  assert.ok(long("Ce que vous recevez") <= 18, "Ce que vous recevez");
  assert.ok(long("Le défavorable aussi") <= 18, "Le défavorable aussi");
  assert.ok(long("Construisons LinkeePost ensemble.") <= 18);
  assert.equal(show(liaisons("Ce que vous recevez")), "Ce~que~vous recevez");
  assert.equal(show(liaisons("Le défavorable aussi")), "Le~défavorable aussi");
  // la ponctuation haute n'est jamais séparée, même dans un bloc long
  assert.ok(liaisons("Une phrase très longue avec un dernier mot : vraiment").includes(`mot${NB}:`));
});

test("titre en deux morceaux : mêmes liaisons que la phrase entière, coupé à la frontière", () => {
  const [a, e] = liaisonsEm("Une IA qui écrit votre post LinkedIn", "invente-t-elle des faits ?");
  assert.equal(a + e, liaisons("Une IA qui écrit votre post LinkedIn invente-t-elle des faits ?"));
  assert.equal(e, `invente-t-elle des${NB}faits${NB}?`);
  const [b, f] = liaisonsEm("Construisons LinkeePost", "ensemble.");
  assert.equal(b + f, liaisons("Construisons LinkeePost ensemble."));
  assert.equal(f, "ensemble.");
  assert.ok(!/LinkeePost\u00a0ensemble/.test(b + f), "bloc de 20 caractères coupé");
});
