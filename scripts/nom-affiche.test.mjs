// Nom affiché : Vercéa partout où un visiteur le lit ; exceptions listées et gardées ; domaine et adresses e-mail inchangés.
// Lancer : node --test scripts/nom-affiche.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BRAND_NAME, BRAND_ANCIEN } from "../lib/brand.js";
import { NOM_DU_TEST } from "../lib/e4Page.js";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|mjs)$/.test(e)) out.push(rel);
  }
  return out;
}
const fichiersGeles = readFileSync(join(ROOT, "docs/demo-editoriale/gel-demo-empreintes.md"), "utf8").match(/`((?:lib|app|scripts|docs)\/[^`\s]+)`/g)?.map((x) => x.slice(1, -1)) ?? [];

test("le nom est Vercéa ; l'ancien nom n'est gardé que pour citer le test E4", () => {
  assert.equal(BRAND_NAME, "Vercéa");
  assert.equal(BRAND_ANCIEN, "LinkeePost");
  assert.equal(NOM_DU_TEST, "LinkeePost");
});

test("plus aucune occurrence de « LinkeePost » dans l'application, sauf exceptions voulues", () => {
  const EXCEPTIONS = new Map([
    ["lib/brand.js", "BRAND_ANCIEN"],
    ["lib/e4Page.js", "nom du produit au moment du test E4"],
    ["lib/gating.js", "fichier gelé de la démo"], ["lib/knowledge.js", "fichier gelé de la démo"], ["lib/demoEditorialCore.mjs", "fichier gelé de la démo"],
  ]);
  const restes = [];
  for (const f of [...walk("app"), ...walk("components"), ...walk("lib")]) {
    if (EXCEPTIONS.has(f) || fichiersGeles.includes(f)) continue;
    read(f).split("\n").forEach((l, i) => { if (l.includes("LinkeePost") && !/User-Agent/.test(l)) restes.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(restes, [], `occurrences restantes : ${restes.join(", ")}`);
});

test("les fichiers gelés de la démo ne sont pas touchés (le gel reste conforme)", () => {
  assert.ok(fichiersGeles.length >= 20, `${fichiersGeles.length} fichiers gelés lus`);
  assert.match(read("lib/gating.js"), /utiliser LinkeePost\./, "message gelé conservé tel quel");
});

test("domaine affiché : plus aucune adresse linkeepost.app (site ni e-mail) dans le code ; la boîte de contact par défaut est celle du nouveau domaine", () => {
  const restes = [];
  for (const f of [...walk("app"), ...walk("components"), ...walk("lib")]) {
    read(f).split("\n").forEach((l, i) => { if (/linkeepost\.app/.test(l)) restes.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(restes, [], `adresses restantes : ${restes.join(", ")}`);
  assert.match(read("lib/contact.js"), /process\.env\.CONTACT_EMAIL \|\| BRAND_CONTACT/);
  assert.match(read("lib/brand.js"), /BRAND_CONTACT = `contact@\$\{BRAND_DOMAINE\}`/);
  assert.match(read("lib/authEmails.js"), /process\.env\.APP_URL \|\| "https:\/\/vercea\.app"/);
  assert.match(read("app/sitemap.js"), /process\.env\.APP_URL \|\| "https:\/\/vercea\.app"/);
});

test("les données structurées lisent APP_URL (le domaine réellement servi) ; l'image de partage et l'animation affichent vercea.app", () => {
  const j = read("components/home/JsonLd.js");
  assert.match(j, /const site = \(process\.env\.APP_URL \|\| "https:\/\/vercea\.app"\)/);
  assert.match(j, /url: site/);
  assert.match(j, /logo: `\$\{site\}\/icon\.svg`/);
  assert.doesNotMatch(j, /linkeepost/);
  assert.match(read("app/opengraph-image.js"), />vercea\.app<\/div>/);
  assert.match(read("components/BrandMotion.js"), />vercea\.app<\/div>/);
});

test("les User-Agent techniques gardent leur identifiant (des sites peuvent les autoriser)", () => {
  assert.match(read("lib/veille.js"), /"User-Agent": "LinkeePost\/1\.0/);
});

test("les pages de preuve citent le test sous son nom de l'époque, avec mention du nouveau", () => {
  const t = read("app/preuves/test-e4/page.js");
  assert.match(t, /Au moment du test, le produit s&apos;appelait \{NOM_DU_TEST\} ; il s&apos;appelle aujourd&apos;hui \{BRAND_NAME\}/);
  assert.doesNotMatch(t.replace(/title: `[^`]*`/, ""), /\$\{BRAND_NAME\} (en a produit|a produit)/);
  assert.match(read("lib/e4Page.js"), /LinkeePost \(aujourd'hui Vercéa\), avec les faits/);
});

test("les e-mails et la page de partage utilisent le nouveau nom", () => {
  for (const f of ["lib/invites.js", "lib/agencyTeam.js", "lib/emailLayout.js", "lib/lifecycleEmails.js"]) assert.ok(read(f).includes("Vercéa"), f);
  assert.match(read("app/manifest.js"), /name: "Vercéa"/);
  assert.match(read("app/layout.js"), /siteName: "Vercéa"/);
});

test("robots.txt est lu à chaque requête : l'adresse du plan du site suit APP_URL du serveur, pas celle du build", () => {
  const r = read("app/robots.js");
  assert.match(r, /export const dynamic = "force-dynamic"/);
  assert.match(r, /export default function robots\(\) \{\s*const SITE = \(process\.env\.APP_URL \|\| "https:\/\/vercea\.app"\)/);
});

test("pied de page et bandeau des e-mails : domaine public du produit et monogramme V, indépendants d'APP_URL", async () => {
  const { BRAND_DOMAINE } = await import("../lib/brand.js");
  assert.equal(BRAND_DOMAINE, "vercea.app");
  const { emailHtml } = await import("../lib/emailLayout.js");
  const avant = process.env.APP_URL;
  try {
    for (const url of ["https://postgenius.network", "https://vercea.app", undefined]) {
      if (url === undefined) delete process.env.APP_URL; else process.env.APP_URL = url;
      const h = emailHtml({ title: "T", paragraphs: ["x"], unsubscribeUrl: "https://postgenius.network/api/email/unsubscribe?t=1" });
      assert.match(h, /Vercéa · <a href="https:\/\/vercea\.app" style="color:#8a97ad">vercea\.app<\/a>/, `pied de page avec APP_URL=${url}`);
      assert.doesNotMatch(h, /Vercéa · <a[^>]*>postgenius/, "plus l'ancien domaine dans le pied de page");
      assert.match(h, /line-height:38px">V<\/td>/);
      assert.doesNotMatch(h, />LP</);
      assert.match(h, /href="https:\/\/postgenius\.network\/api\/email\/unsubscribe\?t=1"[^>]*>Ne plus recevoir ces e-mails/, "le lien de désinscription garde l'adresse reçue");
    }
  } finally { if (avant === undefined) delete process.env.APP_URL; else process.env.APP_URL = avant; }
});

test("la politique de confidentialité (anglais) porte le nouveau nom, cite l'ancien une fois et pointe vers vercea.app ; son adresse ne change pas", () => {
  const p = read("app/privacy-policy/page.js");
  assert.match(p, /\$\{BRAND_NAME\} \(https:\/\/\$\{BRAND_DOMAINE\}\), previously named \$\{BRAND_ANCIEN\}/);
  assert.equal((p.match(/BRAND_ANCIEN/g) ?? []).length, 2, "importé et cité une seule fois");
  assert.doesNotMatch(p, /LinkeePost|linkeepost/);
  assert.match(p, /alternates: \{ canonical: "\/privacy-policy" \}/, "l'adresse de la page reste /privacy-policy");
});

test("les produits créés sur Stripe portent le nom affiché, pas l'ancien (ils figurent sur la page de paiement et les factures)", () => {
  const s = read("scripts/stripe-setup.mjs");
  for (const plan of ["Essentiel", "Pro", "Agence"]) assert.ok(s.includes(`name: "Vercéa ${plan}"`), plan);
  assert.doesNotMatch(s, /LinkeePost/);
});
