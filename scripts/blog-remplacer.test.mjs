// Remplacement de l'article de blog sur le contrôle de forme (scripts/blog-remplacer-controle-de-forme.mjs), exécuté contre une base simulée.
// Lancer : node --test scripts/blog-remplacer.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = fs.readFileSync(new URL("../scripts/blog-remplacer-controle-de-forme.mjs", import.meta.url), "utf8");
const DRAFT = fs.readFileSync(new URL("../outputs/blog-score-engagement.md", import.meta.url), "utf8");
const dm = DRAFT.match(/TITRE :\n(.*)\n\nRÉSUMÉ[^\n]*\n(.*)\n\nIMAGE[\s\S]*?CONTENU[^\n]*\n─+\n\n([\s\S]*)$/);
const OLD = { id: "a1", slug: "le-score-d-engagement-savez-vous-si-votre-post-linkedin-va-marcher", title: "Le score d'engagement : savez-vous si votre post LinkedIn va marcher, avant de le publier ?", excerpt: "ancien", content: "## Les 7 critères qui composent votre score\n- **Accroche (20 points)** …", published: true };

// Exécute le script avec une base simulée ; renvoie ce qui a été affiché et les écritures demandées
async function run(articles, argv = []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-remplacer-"));
  const file = path.join(tmp, `script-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, SRC.replace('import { PrismaClient } from "@prisma/client";', "const PrismaClient = globalThis.__FakePrisma;"));
  const updates = [];
  globalThis.__FakePrisma = class { article = { findMany: async () => articles, update: async (q) => { updates.push(q); } }; $disconnect = async () => {}; };
  const out = [];
  const log = console.log; console.log = (...a) => out.push(a.join(" "));
  const argvBefore = process.argv; process.argv = ["node", "-", ...argv];
  try { await import(pathToFileURL(file).href); } finally { console.log = log; process.argv = argvBefore; }
  return { out: out.join("\n"), updates };
}

test("le texte intégré au script est exactement celui du brouillon (aucune dérive)", () => {
  assert.ok(dm, "brouillon lisible");
  assert.ok(SRC.includes(JSON.stringify(dm[1])), "titre");
  assert.ok(SRC.includes(JSON.stringify(dm[2])), "résumé");
  assert.ok(SRC.includes(JSON.stringify(dm[3].replace(/\n+$/, ""))), "contenu");
});

test("simulation par défaut : trouve l'ancien article et n'écrit rien", async () => {
  const { out, updates } = await run([OLD, { id: "b", slug: "autre", title: "Quand publier", excerpt: "", content: "…", published: true }]);
  assert.equal(updates.length, 0);
  assert.match(out, new RegExp(`/blog/${OLD.slug}`));
  assert.match(out, /Simulation/);
});

test("--apply : ne change que titre, résumé et contenu ; adresse, date, image et état publié restent", async () => {
  const { updates } = await run([OLD], ["--apply"]);
  assert.equal(updates.length, 1);
  assert.deepEqual(Object.keys(updates[0].data).sort(), ["content", "excerpt", "title"]);
  assert.equal(updates[0].where.id, "a1");
  assert.equal(updates[0].data.title, dm[1]);
  assert.ok(!/20 points|600 et 1 600/.test(updates[0].data.content), "plus de poids ni de seuil faux");
  assert.match(updates[0].data.content, /Accroche \(25 points\)/);
});

test("ambiguïté : plusieurs candidats, rien n'est écrit ; --slug lève l'ambiguïté", async () => {
  const two = [OLD, { ...OLD, id: "a2", slug: "autre-score", title: "Score d'engagement : une autre version" }];
  const amb = await run(two, ["--apply"]);
  assert.equal(amb.updates.length, 0);
  assert.match(amb.out, /2 articles correspondent/);
  const ok = await run(two, ["--apply", "--slug=autre-score"]);
  assert.equal(ok.updates.length, 1);
  assert.equal(ok.updates[0].where.id, "a2");
});

test("déjà remplacé ou introuvable : rien n'est écrit", async () => {
  const done = await run([{ ...OLD, title: dm[1] }], ["--apply"]);
  assert.equal(done.updates.length, 0);
  assert.match(done.out, /Déjà remplacé/);
  const none = await run([{ ...OLD, title: "Autre sujet", content: "rien" }], ["--apply"]);
  assert.equal(none.updates.length, 0);
  assert.match(none.out, /Aucun article trouvé/);
});
