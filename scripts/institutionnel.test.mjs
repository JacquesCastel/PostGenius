// /a-propos et /legal : fermées tant qu'un champ à compléter reste, même interrupteur posé ; rien n'est inventé ni recopié.
// Lancer : node --test scripts/institutionnel.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aProposOuvert, legalOuvert, textesALegalCompleter, MARQUEUR_A_COMPLETER } from "../lib/siteInstitutionnel.js";
import { A_PROPOS, champsManquants, portraitPresent } from "../lib/aPropos.js";

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
  assert.deepEqual(champsManquants(A_PROPOS), [], "pourquoi + éditeur remplis : la page peut s'ouvrir");
  assert.match(A_PROPOS.pourquoi, /^L'idée est simple\. Elle est venue/);
  assert.equal(portraitPresent(A_PROPOS), false, "portrait volontairement absent");
  const demi = { ...A_PROPOS, portrait: { prenomNom: "A B", role: null, presentation: null } };
  assert.deepEqual(champsManquants(demi), ["portrait.role", "portrait.presentation"], "portrait à moitié rempli = page fermée");
  // tant qu'un champ manque, la page reste fermée même interrupteur posé
  assert.equal(aProposOuvert({ SITE_APROPOS: "1" }, champsManquants(demi)), false);
  assert.equal(aProposOuvert({ SITE_APROPOS: "1" }, champsManquants(A_PROPOS)), true);
  assert.equal(aProposOuvert({}, champsManquants(A_PROPOS)), false, "sans interrupteur : fermée");
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

test("pages publiques sans équivalent v2 : /privacy-policy et /securite utilisent le gabarit du nouveau site", () => {
  for (const f of ["app/privacy-policy/page.js", "app/securite/page.js"]) {
    const s = read(f);
    assert.match(s, /import Shell from "@\/components\/v2\/Shell"/, f);
    assert.doesNotMatch(s, /SiteHeader|SiteFooter/, f);
  }
  assert.match(read("app/privacy-policy/page.js"), /alternates: \{ canonical: "\/privacy-policy" \}/);
});

test("pages de preuve : les liens vers le test, l'annexe et les gists s'ouvrent dans un nouvel onglet, sans fuite du référent", () => {
  const p = read("app/preuves/page.js"), t = read("app/preuves/test-e4/page.js");
  const cible = 'target="_blank" rel="noopener noreferrer"';
  for (const motif of ["<a href={E4.gists.gel} ", '<Link href="/preuves/test-e4" ', "annexe-textes.md`} "]) assert.ok(p.includes(`${motif}${cible}`), motif);
  assert.ok(t.includes(`<a key={titre} href={href} ${cible}`));
});

test("écran de connexion et fenêtre d'au revoir : palette du nouveau site, identifiants de test conservés", () => {
  const page = read("app/app/page.js");
  const auth = page.slice(page.indexOf("function AuthScreen"), page.indexOf("// Modal de programmation"));
  assert.match(auth, /<SiteHeader variant="v2" \/>/); assert.match(auth, /<SiteFooter variant="v2" \/>/);
  assert.doesNotMatch(auth, /#ff5a5f|bg-gradient-to-b from-rose-50|#d63b42|#b3282f/);
  for (const id of ["auth-email", "auth-password", "auth-submit", "reg-continue"]) assert.ok(auth.includes(id), id);
  const g = read("components/GoodbyeDialog.js");
  assert.doesNotMatch(g, /#ff5a5f|from-rose-50|LpMark/);
  for (const id of ["goodbye", "goodbye-title", "goodbye-home", "goodbye-login"]) assert.ok(g.includes(`"${id}"`), id);
  assert.ok(g.includes("/app?mode=login"));
});

test("parcours d'inscription : le même panneau « Ce qui vous attend » et la même mise en page sur les cinq étapes", () => {
  const page = read("app/app/page.js");
  assert.match(page, /const PARCOURS_ETAPES = \[/);
  assert.equal((page.match(/<ParcoursApercu /g) ?? []).length, 2, "écran des trois questions + parcours");
  const w = page.slice(page.indexOf("function OnboardingWizard"), page.indexOf("// Vue Clients — tableau de bord agence"));
  assert.match(w, /\{selfFlow && <SiteHeader variant="v2" \/>\}/);
  assert.match(w, /\{selfFlow && <SiteFooter variant="v2" \/>\}/);
  assert.match(w, /<ParcoursApercu courant=\{pillIdx\} \/>/);
  assert.doesNotMatch(w, /linear-gradient\(180deg,#fff1f2|#ff5a5f/);
  for (const id of ["wizard-header", "wizard-pills", "wizard-pill", "wizard-where-count"]) assert.ok(w.includes(id), id);
  assert.match(w, /Étape \{selfFlow \? pillIdx \+ 1 : step \+ 1\} sur \{selfFlow \? pills\.length : flow\.length\}/, "le compteur suit les cinq pastilles");
});

test("À propos : le sous-titre « Pourquoi » s'accorde avec l'outil (« Né », pas « Nés »)", () => {
  const s = read("app/a-propos/page.js");
  assert.ok(s.includes("Né d'un constat, pas d'une promesse."));
  assert.ok(!s.includes("Nés d'un constat"));
});
