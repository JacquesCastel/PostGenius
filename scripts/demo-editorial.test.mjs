// Invariants de la démonstration éditoriale après la décision du 10 novembre 2026 (Wharf exclu, expert indépendant ajouté).
// Lancer : node --test scripts/demo-editorial.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { IDENTITIES, COMPANY_IDS, PROFILE_FIELDS, SUBJECT, identityOf, recordHash, validateEntry, cleanComparison, displayOf } from "../lib/demoEditorialCore.mjs";

test("composition : ASTER, AXIOME, l'expert, puis le témoin ; Wharf n'y figure plus", () => {
  assert.deepEqual(IDENTITIES.map((i) => i.id), ["aster", "axiome", "expert", "temoin"]);
  assert.deepEqual(COMPANY_IDS, ["aster", "axiome", "expert"]);
  assert.equal(IDENTITIES.filter((i) => i.control).length, 1);
  assert.ok(!/wharf/i.test(JSON.stringify(IDENTITIES)));
});

test("transparence : tous les profils sont déclarés fictifs", () => {
  assert.ok(IDENTITIES.every((i) => i.fictional === true));
  assert.equal(identityOf("expert").name, "Mathis Garlandier");
  assert.equal(identityOf("expert").profile.companyName, "Garlandier Conseil");
});

test("la forme ne distingue pas les profils : mêmes consignes de style pour tous, témoin compris", () => {
  const styles = new Set(IDENTITIES.map((i) => i.profile.styleNotes));
  assert.equal(styles.size, 1);
  assert.match([...styles][0], /Aucun chiffre inventé/);
});

test("profils complets et sans chiffre : trois profils avec tous les champs, le témoin sans aucun profil", () => {
  for (const id of COMPANY_IDS) {
    const p = identityOf(id).profile;
    for (const f of PROFILE_FIELDS) assert.ok(typeof p[f] === "string" && p[f].trim().length > 10, `${id}.${f}`);
    for (const f of PROFILE_FIELDS) assert.ok(!/\d/.test(p[f]), `${id}.${f} contient un chiffre (le profil ne doit en fournir aucun)`);
  }
  const t = identityOf("temoin").profile;
  for (const f of PROFILE_FIELDS.filter((x) => x !== "styleNotes")) assert.equal(t[f], null, f);
});

test("les trois profils se distinguent : convictions, accents et cartes différents", () => {
  const ids = COMPANY_IDS.map(identityOf);
  assert.equal(new Set(ids.map((i) => i.profile.editorialLine)).size, 3);
  assert.equal(new Set(ids.map((i) => i.accent)).size, 3);
  assert.equal(new Set(ids.map((i) => displayOf(i).conviction)).size, 3);
});

const fakeEntry = (id, over = {}) => {
  const identity = identityOf(id);
  const record = { request: { theme: SUBJECT.text }, profile: { ...identity.profile }, response: { text: "Un texte." }, ...over };
  return { record, recordHash: recordHash(record), engine: { route: "POST /api/generate" } };
};
test("un enregistrement valide est accepté pour chaque identité ; un profil modifié ou un sujet modifié est refusé", () => {
  for (const i of IDENTITIES) assert.deepEqual(validateEntry(fakeEntry(i.id), i.id), { ok: true, reasons: [] }, i.id);
  const e = identityOf("expert"), altered = fakeEntry("expert", { profile: { ...e.profile, editorialLine: "Autre conviction." } });
  assert.match(validateEntry(altered, "expert").reasons.join(), /profil différent \(editorialLine\)/);
  assert.match(validateEntry(fakeEntry("aster", { request: { theme: "autre sujet" } }), "aster").reasons.join(), /sujet/);
  assert.equal(validateEntry(fakeEntry("expert"), "wharf").ok, false, "identité inconnue");
});

test("lecture comparative : colonnes aster, axiome, expert", () => {
  const c = cleanComparison({ authoredBy: "Jacques", rows: [{ label: "Problème retenu", aster: "a", axiome: "b", expert: "c", wharf: "ignoré" }, { label: "vide" }] });
  assert.deepEqual(c.rows, [{ label: "Problème retenu", aster: "a", axiome: "b", expert: "c" }]);
});

import fs from "node:fs";
test("plan de l'article 3 (v3) : aucun reste de l'ancien décompte hors du tableau des modifications et du texte barré (risques levés)", () => {
  const plan = fs.readFileSync(new URL("../docs/demo-editoriale/plan-article-3-v3.md", import.meta.url), "utf8");
  const apres = plan.split("## Décisions tranchées le 10 novembre 2026")[1];
  assert.ok(apres, "section des décisions");
  const vivant = apres.replace(/~~[\s\S]*?~~/g, "");
  const motif = /cinq textes|cinq générations|quatre identités|quatre profils|quatre points de vue|quatre entreprises|trois industrielles/i;
  assert.ok(!motif.test(vivant), (vivant.match(new RegExp(`.{30}(${motif.source}).{20}`, "i")) || [""])[0]);
  assert.match(plan, /PR 344 déjà fusionnée/);
});
