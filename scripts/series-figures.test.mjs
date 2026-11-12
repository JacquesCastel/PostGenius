// Contrôle « Chiffres à vérifier » pour une série de posts : base recalculée à part (/api/figures), la route de génération étant figée.
// Lancer : node --test scripts/series-figures.test.mjs. Les routes (alias « @/ ») sont vérifiées par lecture du code.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL(f, import.meta.url), "utf8");
const gen = read("../app/api/generate/route.js");
const fig = read("../app/api/figures/route.js");
const page = read("../app/app/page.js");

test("le moteur de génération n'est pas modifié par ce contrôle", () => {
  assert.ok(!gen.includes("api/figures"));
});

test("/api/figures recalcule la base comme la génération : mêmes informations, mêmes appels, même ordre", () => {
  // Informations transmises à numberBase : thématique, expertise, contexte du post, profil, remarques, connaissances
  for (const piece of ["JSON.stringify(params.postContext ?? {})", "JSON.stringify(remarks ?? [])", "figureKnowledge"]) {
    assert.ok(gen.includes(piece) && fig.includes(piece), `absent d'une des deux routes : ${piece}`);
  }
  // Même construction des connaissances : sources proches du sujet, temps fort, éléments de langage validés
  assert.ok(gen.includes("knowledgeFor(userId, topic, ctx?.id ?? null, { sourceIds:") && fig.includes("knowledgeFor(userId, theme, ctx?.id ?? null, { sourceIds:"));
  for (const call of ["momentBlock(moment)", "languageBlock(", "overlayProfile(profile, ctx)"]) {
    assert.ok(gen.includes(call) && fig.includes(call), `appel absent d'une des deux routes : ${call}`);
  }
  // Le profil n'inclut pas les exemples de posts (anciens textes de l'auteur), comme dans la génération
  assert.ok(gen.includes("styleExamples: _examples") && !/styleExamples/.test(fig));
});

test("/api/figures : réservée aux comptes connectés, limitée, sans appel à l'IA de rédaction", () => {
  assert.ok(fig.includes("getUserId(req)") && fig.includes("401") && fig.includes("rateLimit("));
  assert.ok(!/api\.anthropic|api\.openai|fetch\(/i.test(fig));
});

test("interface : chaque post d'une série est contrôlé, et un contrôle indisponible est dit", () => {
  assert.ok(page.includes('fetch("/api/figures"'));
  assert.ok(page.includes("figuresToCheck(p.text, sf.base)"), "un contrôle par post de la série");
  assert.ok(page.includes("Contrôle des chiffres indisponible") && page.includes("Contrôle des chiffres en cours"), "l'absence d'alerte n'est jamais présentée comme « aucun écart » quand le contrôle n'a pas eu lieu");
  assert.ok(page.includes("seriesFigures.key === (seriesResult[0]?.text"), "une base tardive d'une génération précédente n'est pas appliquée à la nouvelle série");
});
