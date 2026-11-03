// Tests de non-régression du nettoyage du témoin D. Lancer : node --test scripts/eval-editorial.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanDirectDetailed, cleanDirect } from "../lib/evalEditorialCore.mjs";

const kinds = (r) => r.removed.map((x) => x.kind);

test("séparateurs internes : les paragraphes authentiques entre deux séparateurs sont conservés", () => {
  const raw = "**Une tolérance trop serrée.**\n\nPremier développement du post.\n\n---\n\nSuite du raisonnement, qui compte.\n\n---\n\nConclusion : la valeur de l'expertise chez Wharf.";
  const t = cleanDirect(raw);
  for (const s of ["Une tolérance trop serrée.", "Premier développement du post.", "Suite du raisonnement, qui compte.", "la valeur de l'expertise chez Wharf."]) assert.ok(t.includes(s), `perdu : ${s}`);
  assert.ok(!t.includes("---"));
});

test("introduction, compteur de caractères et séparateurs d'enveloppe sont retirés", () => {
  const r = cleanDirectDetailed("Voici un post LinkedIn rédigé à partir de votre information :\n\n---\n\nLe corps du post.\n\n---\n\n**1 297 caractères**");
  assert.equal(r.text, "Le corps du post.");
  assert.ok(kinds(r).includes("introduction") && kinds(r).includes("compteur"));
});

test("titre markdown d'introduction (« # Post LinkedIn – X ») retiré", () => {
  const r = cleanDirectDetailed("# Post LinkedIn – ASTER INDUSTRIE\n\n---\n\nCorps du post.\n\n---\n\n*ASTER INDUSTRIE — Usinage de précision*");
  assert.ok(!r.text.includes("Post LinkedIn"));
  assert.ok(r.text.includes("Corps du post.") && r.text.includes("ASTER INDUSTRIE — Usinage de précision"), "la signature de fin fait partie du post");
});

test("une question ou une signature en italique en fin de post est conservée (sans les astérisques)", () => {
  const t = cleanDirect("Corps du post.\n\n---\n\n*Et vous, comment gérez-vous l'intégration ?*");
  assert.ok(t.includes("Et vous, comment gérez-vous l'intégration ?") && !t.includes("*"));
});

test("une note de Claude est retirée ET consignée comme commentaire", () => {
  const r = cleanDirectDetailed("Corps du post.\n\n---\n\n*Note : j'ai écarté la donnée des -20 % car elle est contradictoire.*");
  assert.equal(r.text, "Corps du post.");
  assert.deepEqual(kinds(r).filter((k) => k === "commentaire"), ["commentaire"]);
  assert.ok(r.removed.find((x) => x.kind === "commentaire").text.includes("j'ai écarté"));
});

test("analyse préalable (D+) : tout ce qui précède le titre « Post LinkedIn » est consigné, le post est intact", () => {
  const raw = "**Avant d'écrire — classement**\n\n**1. FAITS DOCUMENTÉS**\n- un fait\n\n---\n\n**Post LinkedIn**\n\nPremier paragraphe du post.\n\nDeuxième paragraphe, avec une conclusion.";
  const r = cleanDirectDetailed(raw);
  assert.equal(r.text, "Premier paragraphe du post.\n\nDeuxième paragraphe, avec une conclusion.");
  assert.ok(r.removed.some((x) => x.kind === "commentaire" && x.text.includes("FAITS DOCUMENTÉS")));
});

test("analyse préalable (D+) sans titre « Post LinkedIn » : le bloc de classement est consigné, le post est intact", () => {
  const raw = "**Classement préalable**\n\n**FAITS DOCUMENTÉS**\n- a\n\n**INTERPRÉTATIONS**\n- b\n\n**INFORMATIONS MANQUANTES**\n- c\n\n---\n\nUn outil déployé dans un atelier.\n\nLa question mérite d'être posée.";
  const r = cleanDirectDetailed(raw);
  assert.equal(r.text, "Un outil déployé dans un atelier.\n\nLa question mérite d'être posée.");
  assert.ok(r.removed.some((x) => x.kind === "commentaire" && x.text.includes("INFORMATIONS MANQUANTES")));
});

test("introduction collée au post, sans séparateur", () => {
  const r = cleanDirectDetailed("Voici un post pour Wharf :\n\nCorps du post.\n\nSuite.");
  assert.equal(r.text, "Corps du post.\n\nSuite.");
});

test("un post qui commence par « Voici » sans être une introduction n'est pas amputé", () => {
  const raw = "Voici ce que nous avons appris sur les tolérances de fabrication, et pourquoi cela change notre façon de travailler avec les clients.\n\nSuite du post.";
  assert.equal(cleanDirect(raw), raw);
});

// Invariants sur les données réelles (ignorés si le fichier n'existe pas : data/ n'est pas versionné)
const RESULTS = path.join(process.cwd(), "data", "eval-editorial", "results.jsonl");
test("données réelles : aucune ligne substantielle du témoin D ne disparaît sans être consignée", { skip: !fs.existsSync(RESULTS) }, () => {
  const rows = fs.readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map(JSON.parse).filter((r) => r.version === "D");
  assert.ok(rows.length > 0);
  const strip = (s) => s.replace(/\*+/g, "").replace(/^#+\s*/, "").trim();
  for (const row of rows) {
    const { text, removed } = cleanDirectDetailed(row.text);
    const gone = removed.map((x) => strip(x.text)).join("\n");
    for (const line of row.text.split("\n").map(strip).filter((l) => l.length >= 40 && !/^-{3,}$/.test(l))) {
      assert.ok(text.includes(line) || gone.includes(line), `ligne perdue sans trace (${row.briefId}/${row.profile}) : « ${line.slice(0, 70)} »`);
    }
    const presentation = removed.some((x) => ["introduction", "compteur", "commentaire"].includes(x.kind));
    if (!presentation) assert.ok(text.length >= 0.93 * row.text.length, `perte excessive sans présentation retirée (${row.briefId}/${row.profile}) : ${row.text.length} → ${text.length}`);
  }
});
