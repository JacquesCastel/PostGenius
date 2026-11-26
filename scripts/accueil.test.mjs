// Nouvelle accueil : fermée par défaut (l'ancienne reste), cartes de preuve seulement si la preuve est publiée, chiffres repris du test E4.
// Lancer : node --test scripts/accueil.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accueilV2Ouvert } from "../lib/siteAccueil.js";
import { E4 } from "../lib/e4Page.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("interrupteur : valeur exacte « 1 » seulement, fermé par défaut", () => {
  assert.equal(accueilV2Ouvert({}), false);
  assert.equal(accueilV2Ouvert({ SITE_ACCUEIL: "true" }), false);
  assert.equal(accueilV2Ouvert({ SITE_ACCUEIL: "1" }), true);
});

test("la page choisit l'ancienne accueil par défaut ; sa métadonnée aussi", () => {
  const s = read("app/page.js");
  assert.match(s, /accueilV2Ouvert\(\) \? <HomeV2 \/> : <LegacyHome \/>/);
  assert.match(s, /if \(!accueilV2Ouvert\(\)\) return legacyMetadata;/);
  assert.match(s, /export const dynamic = "force-dynamic"/);
});

test("l'ancienne accueil est déplacée sans changer de contenu : mêmes données et même rendu (hors données structurées partagées)", () => {
  const s = read("components/home/LegacyHome.js");
  for (const x of ["export default async function Landing()", "await getLanding()", "const FEATURES = [", "const PILLARS = [", "const ORIGIN = [", "<SiteHeader />", "<SiteFooter />", "<JsonLd />"]) assert.ok(s.includes(x), x);
  assert.match(s, /title: "Vercéa — Votre expertise, vos mots, vos posts LinkedIn"/);
});

test("les données structurées sont celles d'avant (organisation et application)", () => {
  const j = read("components/home/JsonLd.js");
  for (const x of ['"@type": "Organization"', '"@type": "SoftwareApplication"', "https://linkeepost.app", 'priceCurrency: "EUR"', 'replace(/</g, "\\\\u003c")']) assert.ok(j.includes(x), x);
});

test("cartes de preuve : seulement si la preuve est publiée ; chiffres lus dans lib/e4Page.js, jamais écrits en dur", () => {
  const h = read("components/home/HomeV2.js");
  assert.match(h, /\{preuvesOuvertes\(\) && \(\s*<section id="preuves"/);
  assert.match(h, /\{preuvesOuvertes\(\) && <Link href="\/preuves"/);
  assert.match(h, /\{B\.moyenne\}/); assert.match(h, /\{C\.moyenne\}/);
  assert.doesNotMatch(h, /2,8|0,3|2,4|6,5/, "aucun chiffre du test écrit en dur dans l'accueil");
  assert.ok(E4.conditions.find((c) => c.code === "B").moyenne && E4.conditions.find((c) => c.notre).moyenne);
});

test("liens vers les pages Produit seulement si elles sont ouvertes ; /scoring existe", () => {
  const h = read("components/home/HomeV2.js");
  assert.match(h, /produitOuvert\(\)\s*\?/);
  assert.equal((h.match(/href="\/produit/g) ?? []).length, 1, "un seul lien vers les pages Produit, dans la fonction conditionnelle");
  assert.match(h, /produitOuvert\(\)\s*\?\s*<Link href="\/produit\/verification"/);
  assert.match(h, /href="\/scoring"/);
});

test("aucune promesse de portée ni de garantie ; l'exemple est fictif", () => {
  const h = read("components/home/HomeV2.js");
  assert.doesNotMatch(h, /(?<!Aucune )garanti(e|t|s)? (que|de|la|le)|zéro erreur|augmente(z)? (votre|vos) (portée|vues)/i);
  assert.match(h, /Exemple fictif/);
  assert.match(h, /Aucune promesse de portée/);
});

test("les affirmations de l'accroche correspondent aux règles contrôlées par le code (émojis, hashtags, tutoiement, longueur)", () => {
  const r = read("lib/consigneRules.js");
  for (const k of ["noEmoji", "maxHashtags", "address", "maxChars"]) assert.ok(r.includes(k), k);
});
