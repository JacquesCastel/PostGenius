// Pages /produit, /produit/methode, /produit/verification : chiffres fidèles au code, pages fermées par défaut, rien de promis.
// Lancer : node --test scripts/produit-pages.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOTS } from "../lib/produitPages.js";
import { produitOuvert } from "../lib/siteProduit.js";
import * as M from "../lib/produitMethode.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const UNITES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
const valeur = (mot) => UNITES[mot.toLowerCase()];

test("les nombres écrits en toutes lettres correspondent au code", () => {
  const langues = read("lib/languages.js"), coach = read("lib/coach.js"), fig = read("lib/figureCheck.js"), edit = read("lib/editLearning.js");
  assert.equal(valeur(MOTS.langues), (langues.match(/\{ code: "/g) ?? []).length, "langues de rédaction");
  assert.equal(valeur(MOTS.seuilCoach), Number(coach.match(/export const MIN_MEASURED = (\d+)/)[1]), "seuil du coach");
  assert.equal(valeur(MOTS.maxChiffres), Number(fig.match(/export function figuresToCheck\([^)]*max = (\d+)/)[1]), "chiffres signalés au plus");
  assert.equal(valeur(MOTS.minModifies), Number(edit.match(/export const MIN_MODIFIED = (\d+)/)[1]), "posts modifiés avant proposition");
});

test("le partage depuis le téléphone existe dans le manifeste", () => {
  assert.match(read("app/manifest.js"), /share_target/);
});

test("« sept points » de consignes : la liste affichée en compte sept", () => {
  assert.equal(M.CONSIGNES_POINTS.length, 7);
  const ids = new Set([...read("lib/consigneRules.js").matchAll(/rules\.push\(\{ id: "(\w+)"/g)].map((m) => m[1]));
  assert.equal(ids.size, 7, `règles distinctes contrôlées par lib/consigneRules.js : ${[...ids].join(", ")}`);
  assert.match(M.CONSIGNES_TEXTE, /sept points/);
});

test("fermées par défaut : 404 sans SITE_PRODUIT=1, ouvertes seulement avec cette valeur exacte", () => {
  assert.equal(produitOuvert({}), false);
  assert.equal(produitOuvert({ SITE_PRODUIT: "true" }), false);
  assert.equal(produitOuvert({ SITE_PRODUIT: "1" }), true);
  for (const p of ["app/produit/page.js", "app/produit/methode/page.js", "app/produit/verification/page.js"]) {
    const s = read(p);
    assert.match(s, /if \(!produitOuvert\(\)\) notFound\(\);/, p);
    assert.match(s, /export const dynamic = "force-dynamic"/, p);
  }
});

test("pas branchées : ni plan du site, ni navigation ; les liens vers /preuves dépendent de son interrupteur", () => {
  assert.doesNotMatch(read("app/sitemap.js"), /produit/);
  assert.doesNotMatch(read("components/SiteHeader.js"), /\/produit/);
  assert.doesNotMatch(read("components/SiteFooter.js"), /\/produit/);
  for (const p of ["app/produit/methode/page.js", "app/produit/verification/page.js"]) assert.match(read(p), /preuvesOuvertes\(\)/, p);
});

test("aucune promesse de portée ni de garantie dans les textes", () => {
  const tout = ["app/produit/page.js", "app/produit/methode/page.js", "app/produit/verification/page.js", "lib/produitMethode.js"].map(read).join("\n");
  assert.doesNotMatch(tout, /garanti(e|t|s)? (que|de|la|le)|100 ?%|zéro erreur|conforme à LinkedIn|augmente(z)? (votre|vos) (portée|vues)/i);
  assert.match(tout, /pas des garanties/);
  assert.match(tout, /ne prédit ni vues, ni réactions/);
});

test("les mentions « En test » sont dans un seul endroit, à retirer à l'ouverture du compagnon éditorial", () => {
  assert.match(M.ETAT_TEST, /comptes sélectionnés/);
  assert.equal(M.CONTROLES_ETAPES.filter((c) => c.test).length + M.CONTROLES_APRES.filter((c) => c.test).length, 2);
});

test("la méthode est accessible depuis l'accueil, les tarifs, À propos et les trois pages Produit ; liens seulement si /produit est ouvert", () => {
  const lien = /href="\/produit\/methode"/;
  assert.match(read("components/home/HomeV2.js"), /\{produitOuvert\(\) && <p className="mt-8"><Link href="\/produit\/methode"/);
  assert.match(read("app/tarifs/page.js"), /\{produitOuvert\(\) && <p[^>]*>Avant de choisir : <Link href="\/produit\/methode"/);
  assert.match(read("app/a-propos/page.js"), /\{produitOuvert\(\) && <> <Link href="\/produit\/methode"/);
  assert.match(read("app/produit/page.js"), lien);
  const barre = read("components/v2/SousNavProduit.js");
  for (const h of ["/produit", "/produit/methode", "/produit/verification"]) assert.ok(barre.includes(`"${h}"`), h);
  assert.match(barre, /aria-current="page"/);
  for (const [f, cur] of [["app/produit/page.js", "/produit"], ["app/produit/methode/page.js", "/produit/methode"], ["app/produit/verification/page.js", "/produit/verification"]]) {
    assert.ok(read(f).includes(`<SousNavProduit courante="${cur}" />`), f);
  }
});
