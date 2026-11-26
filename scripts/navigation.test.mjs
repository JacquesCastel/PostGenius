// Navigation du nouveau style : un lien n'existe que si sa page est ouverte ; les pages fermées n'apparaissent jamais.
// Lancer : node --test scripts/navigation.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pagesOuvertes, navEntete, colonnesPied, pagesPlanDuSite } from "../lib/siteNav.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const A_PROPOS_COMPLET = { pourquoi: "x", editeur: { raisonSociale: "x", formeJuridique: "x", villeSiege: "x" }, portrait: { prenomNom: "x", role: "x", presentation: "x" }, engagementCorrection: "x" };
const liens = (nav) => nav.map(([h]) => h);
const tousLiens = (c) => Object.values(c).flat().map(([h]) => h);

test("rien n'est ouvert par défaut : la navigation est celle d'avant (pages existantes seulement)", () => {
  const o = pagesOuvertes({ env: {} });
  assert.deepEqual(o, { produit: false, preuves: false, apropos: false, legal: false });
  assert.deepEqual(liens(navEntete(o)), ["/fonctionnalites", "/tarifs", "/blog", "/contact"]);
  const c = colonnesPied(o);
  assert.deepEqual(c.produit.map(([h]) => h), ["/fonctionnalites", "/comment-ca-marche", "/scoring", "/tarifs"]);
  assert.deepEqual(c.ressources.map(([h]) => h), ["/blog", "/contact"]);
  assert.deepEqual(c.societe, []);
  assert.deepEqual(c.legal.map(([h]) => h), ["/mentions-legales", "/cgu", "/confidentialite", "/securite", "/privacy-policy"]);
  assert.deepEqual(pagesPlanDuSite(o), []);
});

test("aucun lien vers une page fermée, quel que soit l'interrupteur isolé", () => {
  const ferme = ["/produit", "/preuves", "/a-propos", "/legal"];
  for (const [env, page] of [[{ SITE_PRODUIT: "1" }, "/preuves"], [{ SITE_PREUVES: "1" }, "/produit"]]) {
    const o = pagesOuvertes({ env });
    assert.ok(!liens(navEntete(o)).includes(page), page);
  }
  // /a-propos : interrupteur posé mais champ obligatoire vide → pas de lien
  assert.equal(pagesOuvertes({ env: { SITE_APROPOS: "1" }, aPropos: { ...A_PROPOS_COMPLET, pourquoi: null } }).apropos, false);
  // /legal : interrupteur posé mais « À COMPLÉTER » → pas de lien
  assert.equal(pagesOuvertes({ env: { SITE_LEGAL: "1" }, legalTextes: ["[À COMPLÉTER : ville]"] }).legal, false);
  assert.ok(ferme.every((p) => !tousLiens(colonnesPied(pagesOuvertes({ env: {} }))).includes(p)));
});

test("tout ouvert : Produit remplace Fonctionnalités, Preuves et À propos apparaissent, /legal remplace les trois pages légales", () => {
  const o = pagesOuvertes({ env: { SITE_PRODUIT: "1", SITE_PREUVES: "1", SITE_APROPOS: "1", SITE_LEGAL: "1" }, legalTextes: ["X SAS"], aPropos: A_PROPOS_COMPLET });
  assert.deepEqual(o, { produit: true, preuves: true, apropos: true, legal: true });
  assert.deepEqual(liens(navEntete(o)), ["/produit", "/preuves", "/tarifs", "/blog", "/a-propos", "/contact"]);
  const c = colonnesPied(o);
  assert.ok(c.produit.some(([h]) => h === "/produit/verification"));
  assert.ok(c.ressources.some(([h]) => h === "/preuves/test-e4"));
  assert.deepEqual(c.societe, [["/a-propos", "À propos"]]);
  assert.deepEqual(c.legal.map(([h]) => h), ["/legal", "/securite", "/privacy-policy"]);
  assert.deepEqual(pagesPlanDuSite(o).map(([h]) => h), ["/produit", "/produit/methode", "/produit/verification", "/preuves", "/preuves/test-e4", "/a-propos", "/legal"]);
});

test("la privacy policy (adresse déclarée à LinkedIn) et la sécurité sont toujours dans le pied de page", () => {
  for (const env of [{}, { SITE_LEGAL: "1" }]) {
    const c = colonnesPied(pagesOuvertes({ env, legalTextes: ["X SAS"] }));
    assert.ok(c.legal.some(([h]) => h === "/privacy-policy") && c.legal.some(([h]) => h === "/securite"));
  }
});

test("câblage : l'ancien style est inchangé ; le gabarit v2 lit les ouvertures à chaque requête", () => {
  const header = read("components/SiteHeader.js"), shell = read("components/v2/Shell.js"), footer = read("components/SiteFooter.js");
  assert.match(header, /nav = NAV_V2/);
  assert.match(header, /const NAV = \[\s*\["\/fonctionnalites", "Fonctionnalités"\],\s*\["\/comment-ca-marche", "Comment ça marche"\],\s*\["\/scoring", "Contrôle de forme"\],/);
  assert.match(shell, /export default async function Shell/);
  assert.match(shell, /await chargerOuvertures\(\)/);
  assert.match(shell, /navEntete\(ouvertures\)/);
  assert.match(footer, /colonnes = colonnesPied\(\{\}\)/);
  assert.match(footer, /<Link href="\/mentions-legales" className="hover:text-\[#ff5a5f\]">Mentions légales<\/Link>/, "pied de page de l'ancien style inchangé");
  assert.match(read("app/sitemap.js"), /const ouvertures = await chargerOuvertures\(\);[\s\S]*pagesPlanDuSite\(ouvertures\)/);
});

test("le lien « À propos » vérifie les champs, pas seulement l'interrupteur ; /legal lit les textes seulement si SITE_LEGAL=1", () => {
  assert.match(read("lib/siteNav.js"), /aProposOuvert\(env, champsManquants\(aPropos\)\)/);
  const srv = read("lib/siteNavServer.js");
  assert.match(srv, /if \(process\.env\.SITE_LEGAL === "1"\)/);
  assert.match(srv, /catch \{[\s\S]*À COMPLÉTER/, "en cas d'erreur de lecture, pas de lien");
});

test("les ouvertures sont lues à chaque requête (connection()), pas figées au build : la page /contact n'a pas d'autre donnée dynamique", () => {
  assert.match(read("lib/siteNavServer.js"), /import \{ connection \} from "next\/server"/);
  assert.match(read("lib/siteNavServer.js"), /export async function chargerOuvertures\(\) \{\s*await connection\(\);/);
  assert.doesNotMatch(read("app/contact/page.js"), /force-dynamic/); // preuve que l'appel doit venir du gabarit
});
