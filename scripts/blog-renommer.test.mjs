// Renommage du produit dans le blog : fonctions pures et garde-fous du script. Lancer : node --test scripts/blog-renommer.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.__IMPORT_ONLY__ = true;
const { renommer, occurrences, planifier, extraits, SLUG_TEST } = await import("../scripts/blog-renommer-produit.mjs");

test("le nom et le domaine changent ; les adresses en minuscules (slugs, liens internes) ne changent jamais", () => {
  assert.equal(renommer("LinkeePost prépare vos posts, sur linkeepost.app."), "Vercéa prépare vos posts, sur vercea.app.");
  assert.equal(renommer("Linkeepost et LinkeePost"), "Vercéa et Vercéa");
  const lien = "[l'outil](/blog/c-est-quoi-linkeepost-l-outil-qui-pilote-votre-presence-linkedin)";
  assert.equal(renommer(lien), lien, "le slug reste tel quel");
  assert.equal(renommer(null), "");
});

test("comptage des occurrences, titre, résumé et corps", () => {
  assert.equal(occurrences("LinkeePost, LinkeePost, linkeepost.app"), 3);
  const p = planifier({ slug: "un-article", title: "C'est quoi LinkeePost ?", excerpt: null, content: "LinkeePost est un outil." });
  assert.equal(p.n, 2);
  assert.equal(p.titre, "C'est quoi Vercéa ?");
  assert.equal(p.excerpt, null);
  assert.equal(p.change, true);
  assert.equal(planifier({ slug: "propre", title: "x", excerpt: "y", content: "z" }).change, false);
});

test("l'article du test E4 est exclu par défaut (note datée à la main) et inclus sur demande", () => {
  const a = { slug: `${SLUG_TEST}-des-faits-notre-test-et-ses`, title: "t", excerpt: "e", content: "LinkeePost a produit très peu." };
  assert.equal(planifier(a).exclu, true);
  assert.equal(planifier(a).change, false);
  assert.equal(planifier(a, { inclureTest: true }).change, true);
});

test("les extraits montrent le contexte de chaque occurrence", () => {
  const e = extraits("Une phrase avant. LinkeePost aide les dirigeants à publier. Une phrase après.", 3);
  assert.equal(e.length, 1);
  assert.match(e[0], /«LinkeePost»/);
});

test("le script : simulation par défaut, sauvegarde avant d'écrire, aucune écriture hors titre, résumé et corps", () => {
  const s = readFileSync(new URL("../scripts/blog-renommer-produit.mjs", import.meta.url), "utf8");
  assert.match(s, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(s, /if \(!apply\) \{ console\.log\("Rien n'a été modifié/);
  assert.ok(s.indexOf("fs.writeFileSync(fichier") < s.indexOf("prisma.article.update"), "la sauvegarde précède l'écriture");
  assert.match(s, /ARRÊT : sauvegarde impossible/, "sans sauvegarde possible, le script s'arrête sans rien modifier");
  assert.ok(s.indexOf("ARRÊT : sauvegarde impossible") < s.indexOf("prisma.article.update"));
  assert.match(s, /const exporter = process\.argv\.includes\("--exporter"\)/);
  assert.match(s, /const sauvegardeExterne = process\.argv\.includes\("--sauvegarde-externe"\)/);
  assert.ok(s.indexOf("if (exporter)") < s.indexOf("console.log(`${apply ?"), "--exporter n'écrit que le JSON : avant tout affichage");
  assert.match(s, /data: \{ title: p\.titre, excerpt: p\.excerpt, content: p\.content \}/);
  assert.doesNotMatch(s, /slug:\s*[a-z.]*renommer|data:\s*\{[^}]*slug/, "le slug n'est jamais modifié");
});
