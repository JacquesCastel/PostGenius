// /a-propos et /legal : fermées tant qu'un champ à compléter reste, même interrupteur posé ; rien n'est inventé ni recopié.
// Lancer : node --test scripts/institutionnel.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aProposOuvert, legalOuvert, textesALegalCompleter, MARQUEUR_A_COMPLETER } from "../lib/siteInstitutionnel.js";
import { A_PROPOS, champsManquants } from "../lib/aPropos.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const complet = { pourquoi: "Une histoire vraie.", editeur: { raisonSociale: "X SAS", formeJuridique: "SAS au capital de 1 000 €", villeSiege: "Paris" }, portrait: { prenomNom: "A B", role: "Fondateur", presentation: "Je…" }, engagementCorrection: "Toute correction est publiée avec sa date." };

test("/a-propos : fermée sans interrupteur, fermée tant qu'un champ manque, ouverte seulement si tout est rempli ET interrupteur « 1 »", () => {
  assert.equal(aProposOuvert({}, []), false);
  assert.equal(aProposOuvert({ SITE_APROPOS: "true" }, []), false);
  assert.equal(aProposOuvert({ SITE_APROPOS: "1" }, ["pourquoi"]), false);
  assert.equal(aProposOuvert({ SITE_APROPOS: "1" }, []), true);
  assert.deepEqual(champsManquants(complet), []);
  assert.ok(champsManquants({ ...complet, pourquoi: "  " }).includes("pourquoi"));
  assert.ok(champsManquants({ ...complet, editeur: { ...complet.editeur, formeJuridique: null } }).includes("editeur.formeJuridique"));
});

test("les informations de l'éditeur sont celles qu'il a données ; le reste reste vide tant que personne ne l'écrit", () => {
  assert.deepEqual(A_PROPOS.editeur, { raisonSociale: "Wharf", formeJuridique: "SARL au capital de 10 000 €", villeSiege: "Paris" });
  const m = champsManquants(A_PROPOS);
  assert.deepEqual(m, ["pourquoi", "portrait.prenomNom", "portrait.role", "portrait.presentation", "engagementCorrection"].filter((c) => m.includes(c)), "seuls ces champs peuvent manquer");
  // tant qu'un champ manque, la page reste fermée même interrupteur posé
  if (m.length) assert.equal(aProposOuvert({ SITE_APROPOS: "1" }, m), false);
});

test("/legal : fermée si un texte contient « À COMPLÉTER », même interrupteur posé", () => {
  assert.equal(legalOuvert({}, ["texte"]), false);
  assert.equal(legalOuvert({ SITE_LEGAL: "1" }, ["édité par [À COMPLÉTER : raison sociale]"]), false);
  assert.equal(legalOuvert({ SITE_LEGAL: "1" }, ["X SAS"]), true);
  assert.equal(legalOuvert({ SITE_LEGAL: "true" }, ["X SAS"]), false);
  assert.equal(textesALegalCompleter(["a", "[À COMPLÉTER : ville]", "À compléter"]), 2);
});

test("les textes légaux actuels contiennent bien des champs à compléter : /legal ne s'ouvrirait pas avec eux", () => {
  assert.match(read("lib/footer-pages.js"), /\[À COMPLÉTER/);
  assert.match("[À COMPLÉTER : ville]", MARQUEUR_A_COMPLETER);
});

test("/legal lit les pages existantes (rien de recopié) ; les adresses actuelles et la privacy policy ne sont pas touchées", () => {
  const p = read("app/legal/page.js");
  assert.match(p, /getFooterPage\(cle\)/);
  assert.match(p, /if \(!legalOuvert\(process\.env, textes\)\) notFound\(\);/);
  assert.doesNotMatch(p, /Hetzner|Neon|SIREN|tribunaux/, "aucun texte légal écrit dans la page");
  // les redirections vers /legal passent toutes par lib/redirections.js (conditionnelles : SITE_REDIRECTIONS=1 et page ouverte) ; la privacy policy n'en a jamais
  for (const f of ["app/mentions-legales/page.js", "app/cgu/page.js", "app/confidentialite/page.js"]) assert.doesNotMatch(read(f), /redirect\(|permanentRedirect/, f);
  for (const f of ["app/privacy-policy/page.js", "app/privacy/page.js"]) assert.doesNotMatch(read(f), /redirigerSiNecessaire|permanentRedirect/, f);
  assert.doesNotMatch(read("next.config.mjs"), /legal/, "aucune redirection vers /legal dans la configuration");
});

test("les pages valident leur interrupteur à chaque requête et ne sont ni dans le plan du site ni dans la navigation", () => {
  for (const f of ["app/a-propos/page.js", "app/legal/page.js"]) assert.match(read(f), /export const dynamic = "force-dynamic"/, f);
  assert.match(read("app/a-propos/page.js"), /if \(!aProposOuvert\(process\.env, champsManquants\(d\)\)\) notFound\(\);/);
  assert.doesNotMatch(read("app/sitemap.js"), /a-propos|\/legal/);
  assert.doesNotMatch(read("components/SiteHeader.js") + read("components/SiteFooter.js"), /a-propos|\/legal/);
});

test("a-propos : aucune promesse de portée ; la réponse chiffrée vient du test E4 (lib/e4Page.js), pas d'un nombre écrit en dur", () => {
  const p = read("app/a-propos/page.js");
  assert.doesNotMatch(p, /garanti(e|t|s)? (que|de|la|le)|zéro erreur|augmente(z)? (votre|vos) (portée|vues)/i);
  assert.match(p, /\{B\.textes\} posts sur 10/);
  assert.match(p, /Nous ne le promettons pas/);
});
