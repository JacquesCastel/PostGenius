// Test du script d'anonymisation E4 (aucune donnée réelle). Lancer : node --test scripts/e4-anonymize.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { assign, newId, shuffle, applyRemovals, paragraphs, loadRecords, TOOL_WORDS } from "./e4-anonymize.mjs";

test("les 70 textes réels se chargent : 7 conditions × 10 sujets, aucun échec", () => {
  const items = loadRecords();
  assert.equal(items.length, 70);
  const count = {};
  for (const i of items) count[i.condition] = (count[i.condition] ?? 0) + 1;
  assert.deepEqual(count, { A: 10, B: 10, AN: 10, BN: 10, C: 10, CN: 10, D: 10 });
  assert.equal(new Set(items.map((i) => `${i.condition}-${i.subject}`)).size, 70);
});

test("identifiants uniques, au bon format, sans lien avec la condition ; la clé garde tout", () => {
  const items = loadRecords();
  const a = assign(items);
  assert.equal(new Set(a.map((x) => x.id)).size, 70);
  assert.ok(a.every((x) => /^T-[2-9A-HJKMNP-Z]{4}$/.test(x.id)));
  assert.ok(!a.some((x) => x.id.includes(x.condition) && x.condition.length > 1));
  assert.deepEqual(a.map((x) => x.recordId).sort(), items.map((x) => x.recordId).sort());
});

test("le mélange est une permutation", () => {
  const src = Array.from({ length: 50 }, (_, i) => i);
  const s = shuffle(src);
  assert.deepEqual(s.slice().sort((x, y) => x - y), src);
});

test("retrait : seulement un paragraphe entier en tête ou en queue, refus sinon", () => {
  const raw = "Voici un post pour vous :\n\nCorps du post.\n\nDeuxième paragraphe.\n\nSouhaitez-vous une version plus courte ?";
  const r = applyRemovals(raw, [{ position: "debut", text: "Voici un post pour vous :" }, { position: "fin", text: "Souhaitez-vous une version plus courte ?" }]);
  assert.equal(r.text, "Corps du post.\n\nDeuxième paragraphe.");
  assert.deepEqual(r.removed.map((x) => x.position), ["début", "fin"]);
  assert.throws(() => applyRemovals(raw, [{ position: "debut", text: "Corps du post." }]), /premier paragraphe/);
  assert.throws(() => applyRemovals(raw, [{ position: "fin", text: "Deuxième paragraphe." }]), /dernier paragraphe/);
  assert.throws(() => applyRemovals("Seul.", [{ position: "debut", text: "Seul." }]), /tout le texte/);
  assert.equal(paragraphs("a\n\nb").length, 2);
});

test("détection des mentions d'outils", () => {
  assert.ok(TOOL_WORDS.test("Écrit avec LinkeePost"));
  assert.ok(TOOL_WORDS.test("selon ChatGPT"));
  assert.ok(!TOOL_WORDS.test("Une tournée de livraison"));
  assert.equal(newId(() => 0), "T-2222");
});
