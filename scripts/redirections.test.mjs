// Redirections de l'ancien site : conditionnelles, jamais vers une 404, jamais pour la privacy policy.
// Lancer : node --test scripts/redirections.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cibleRedirection, REDIRECTIONS, JAMAIS_REDIRIGEES } from "../lib/redirections.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const tout = { produit: true, preuves: true, apropos: true, legal: true };
const rien = { produit: false, preuves: false, apropos: false, legal: false };

test("sans SITE_REDIRECTIONS=1, aucune redirection, même si tout est ouvert", () => {
  for (const chemin of Object.keys(REDIRECTIONS)) {
    assert.equal(cibleRedirection(chemin, tout, {}), null, chemin);
    assert.equal(cibleRedirection(chemin, tout, { SITE_REDIRECTIONS: "true" }), null, chemin);
  }
});

test("avec l'interrupteur, redirection seulement si la destination est ouverte (jamais vers une 404)", () => {
  const env = { SITE_REDIRECTIONS: "1" };
  assert.equal(cibleRedirection("/fonctionnalites", rien, env), null);
  assert.equal(cibleRedirection("/fonctionnalites", { ...rien, produit: true }, env), "/produit");
  assert.equal(cibleRedirection("/comment-ca-marche", { ...rien, produit: true }, env), "/produit/methode");
  assert.equal(cibleRedirection("/mentions-legales", { ...rien, produit: true }, env), null, "legal fermée : pas de redirection");
  assert.equal(cibleRedirection("/mentions-legales", { ...rien, legal: true }, env), "/legal#mentions");
  assert.equal(cibleRedirection("/cgu", { ...rien, legal: true }, env), "/legal#cgu");
  assert.equal(cibleRedirection("/confidentialite", { ...rien, legal: true }, env), "/legal#confidentialite");
});

test("la privacy policy (adresse déclarée à LinkedIn) n'est jamais redirigée, quoi qu'on pose", () => {
  assert.deepEqual(JAMAIS_REDIRIGEES, ["/privacy-policy", "/privacy"]);
  for (const chemin of JAMAIS_REDIRIGEES) {
    assert.equal(cibleRedirection(chemin, tout, { SITE_REDIRECTIONS: "1" }), null, chemin);
    assert.ok(!(chemin in REDIRECTIONS));
  }
});

test("seules les cinq anciennes adresses prévues sont redirigées ; chaque destination existe", () => {
  assert.deepEqual(Object.keys(REDIRECTIONS).sort(), ["/cgu", "/comment-ca-marche", "/confidentialite", "/fonctionnalites", "/mentions-legales"]);
  for (const { vers } of Object.values(REDIRECTIONS)) {
    const chemin = vers.split("#")[0];
    const fichier = `app${chemin}/page.js`;
    assert.ok(readFileSync(new URL(`../${fichier}`, import.meta.url)).length > 0, fichier);
  }
});

test("câblage : chaque ancienne page appelle redirigerSiNecessaire avec sa propre adresse ; pas de redirection dans next.config", () => {
  for (const [chemin, fichier] of [["/fonctionnalites", "fonctionnalites"], ["/comment-ca-marche", "comment-ca-marche"], ["/mentions-legales", "mentions-legales"], ["/cgu", "cgu"], ["/confidentialite", "confidentialite"]]) {
    assert.match(read(`app/${fichier}/page.js`), new RegExp(`await redirigerSiNecessaire\\("${chemin}"\\);`), fichier);
  }
  assert.doesNotMatch(read("next.config.mjs"), /redirects/);
  const srv = read("lib/siteNavServer.js");
  assert.match(srv, /export async function redirigerSiNecessaire\(chemin\)/);
  assert.match(srv, /permanentRedirect\(cible\)/);
  assert.match(srv, /await connection\(\);/, "lecture à chaque requête");
});
