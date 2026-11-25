// Page /scoring : les nombres affichés correspondent à lib/score.js (points, seuils) ; tarifs : même contenu, nouveau style.
// Lancer : node --test scripts/scoring-page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const score = read("lib/score.js"), page = read("app/scoring/page.js");
const regles = read("lib/linkedinRules.js"); // seuils (RULES) : lecture seule, fichier gelé de la démo

test("points par critère : mêmes valeurs que lib/score.js, total 100", () => {
  const dansCode = [...score.matchAll(/add\(\s*"([^"]+)",\s*[\w\s?:.()>=<&|+*-]+,\s*(\d+),/g)].map((m) => [m[1], Number(m[2])]);
  const dansPage = [...page.matchAll(/\{ label: "([^"]+)", points: (\d+), texte/g)].map((m) => [m[1], Number(m[2])]);
  assert.equal(dansPage.length, 7, "sept critères affichés");
  assert.equal(dansPage.reduce((s, [, n]) => s + n, 0), 100);
  const norm = (s) => s.toLowerCase().replace(/&/g, "et").replace(/ \/ /g, " ou ");
  for (const [label, n] of dansPage) {
    const code = dansCode.find(([l]) => norm(l) === norm(label));
    assert.ok(code, `critère absent du code : ${label}`);
    assert.equal(code[1], n, `${label} : points`);
  }
});

test("seuils écrits dans le texte = RULES de lib/linkedinRules.js", () => {
  const r = (k) => Number(regles.match(new RegExp(`${k}:\\s*(\\d+)`))[1]);
  assert.match(page, new RegExp(`Moins de ${r("hookMax")} caractères`));
  assert.match(page, new RegExp(`Entre ${r("lengthMin")} et ${String(r("lengthMax")).replace(/(\d)(\d{3})$/, "$1 $2")} caractères`));
  assert.match(page, new RegExp(`Au-delà de ${r("hashtagsMax")}`));
  assert.match(page, new RegExp(`De 0 à ${r("emojisMax")} émojis`));
  assert.match(page, /Bien construit/);
  assert.match(score, /score >= 80 \? "Bien construit"/); // l'exemple affiché (85) est bien dans « Bien construit »
});

test("l'exemple est fictif et dit qu'il ne prévoit rien ; aucune promesse de portée", () => {
  assert.match(page, /Exemple de mise en forme · fictif/);
  assert.match(page, /Elle ne prévoit aucune vue ni aucune réaction/);
  assert.doesNotMatch(page, /garanti|100 ?%|augmente(z)? (votre|vos) (portée|vues)/i);
});

test("le lien vers « Chiffres à vérifier » dépend de l'interrupteur des pages Produit", () => {
  assert.match(page, /produitOuvert\(\) \?/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
});

test("tarifs : nouveau gabarit, mêmes données et mêmes textes (offres, comparatif, bêta / essai)", () => {
  const t = read("app/tarifs/page.js"), cards = read("components/PricingCards.js");
  assert.match(t, /import Shell from "@\/components\/v2\/Shell"/);
  assert.doesNotMatch(t, /SiteHeader|SiteFooter/);
  for (const x of ["getLanding()", "PLAN_IDS.map", "COMPARE.map", "row.value(PLANS[id])", "pick(\"Rejoindre la bêta\", \"Démarrer l'essai gratuit\")",
    "Pendant la bêta fermée, l'accès est offert aux testeurs invités, sans carte bancaire. Tarifs prévus à l'ouverture publique.",
    "14 jours d'essai gratuit sur tous les plans, sans carte bancaire. Sans engagement, résiliable à tout moment.",
    "« Illimité » s'entend dans le cadre d'un usage individuel raisonnable."]) assert.ok(t.includes(x), x);
  assert.match(t, /variant="v2"/);
  // la logique des cartes (prix annuel, lien d'inscription) n'a pas changé
  for (const x of ["yearlyPrice(monthly)", "BETA ? \"/beta\" : `/app?plan=${card.id}`", "(yearly / 12).toFixed(2)"]) assert.ok(cards.includes(x), x);
});
