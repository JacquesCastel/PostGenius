// Les campagnes utilisent le même contrôle des chiffres que les posts libres (lib/figureCheck.js). Lancer : node --test scripts/campaign-figures.test.mjs
// lib/campaignChecks.js importe sans extension (résolu par Next) : un petit résolveur ajoute « .js » le temps du test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("data:text/javascript," + encodeURIComponent(`
import fs from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("./") && !/\\.[a-z]+$/.test(spec) && ctx.parentURL) {
    const p = new URL(spec + ".js", ctx.parentURL);
    if (fs.existsSync(fileURLToPath(p))) return next(p.href, ctx);
  }
  return next(spec, ctx);
}
`), import.meta.url);

const { checkPost } = await import("../lib/campaignChecks.js");
const brief = { context: "Chiffre d'affaires : 2,4 millions d'euros, 17 personnes.", message: "11 collaborateurs formés.", objective: "", rules: [], forbidden: [] };
const item = { angle: "Bilan de l'année", objective: "", toConfirm: "", cta: "" };
const figures = (text) => checkPost({ text, item, brief, account: { kind: "person" } }).filter((i) => i.code === "figures");

test("un chiffre fourni par le brief n'est pas signalé, quel que soit son format", () => {
  assert.equal(figures("Nous sommes 17 personnes, avec 2,4 millions d'euros de chiffre d'affaires.").length, 0);
});

test("un chiffre absent du brief est signalé comme « à confirmer », avec son unité", () => {
  const f = figures("Une hausse de 37 % cette année.");
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "warn");
  assert.match(f[0].text, /37 %/);
});

test("même règle qu'un post libre : « 11 mois » n'est pas « 11 collaborateurs »", () => {
  assert.equal(figures("11 collaborateurs ont été formés.").length, 0);
  assert.match(figures("En 11 mois, tout a changé.")[0].text, /11 mois/);
});

test("l'ancien contrôle, qui laissait passer un nombre sans unité listée, est remplacé", () => {
  assert.equal(figures("Nous avons accompagné 48 entreprises.").length, 1, "« 48 entreprises » est signalé (absent du brief)");
});

test("un seul algorithme : campaignChecks utilise lib/figureCheck.js et ne garde plus sa propre expression de chiffres", () => {
  const src = fs.readFileSync(new URL("../lib/campaignChecks.js", import.meta.url), "utf8");
  assert.ok(src.includes('from "./figureCheck"') && src.includes("figuresToCheck("));
  assert.ok(!src.includes("collaborateurs|films"), "l'ancienne liste d'unités a disparu");
});
