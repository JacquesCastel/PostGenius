// Contrôle de cohérence du compte rendu et de l'annexe avec les résultats calculés. Lancer : node --test scripts/e4-annexe.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const D = new URL("../docs/e4-chiffres/", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, D), "utf8");

const rows = (md) => md.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/\*/g, "").trim()));
const fr = (x) => Number(String(x).replace(",", "."));

test("l'annexe contient les 70 textes, 7 conditions, chaque identifiant une fois", () => {
  const a = read("compte-rendu/annexe-textes.md");
  const ids = [...a.matchAll(/^### .+ \((T-[0-9A-Z]{4})\)$/gm)].map((m) => m[1]);
  assert.equal(ids.length, 70);
  assert.equal(new Set(ids).size, 70);
  assert.equal([...a.matchAll(/^## Condition /gm)].length, 7);
});

test("moyennes et totaux du compte rendu = résultats calculés (analyses principale et de sensibilité)", () => {
  const cr = read("compte-rendu/compte-rendu-E4.md"), main = read("resultats/resultats.md"), sens = read("resultats/resultats-sensibilite.md");
  const calc = (md) => Object.fromEntries(rows(md).filter((r) => /^(A|B|C|D|AN|BN|CN)$/.test(r[0]) && r.length >= 7).map((r) => [r[0], { moy: fr(r[2]), total: Number(r[3]) }]));
  const M = calc(main), S = calc(sens);
  const tab = rows(cr).filter((r) => /^(A|B|C|D|AN|BN|CN)\b/.test(r[0]) && r.length === 5);
  assert.equal(tab.length, 7);
  for (const r of tab) { const c = r[0].split(",")[0].trim().split(" ")[0]; assert.equal(Number(r[1]), M[c].total, `total ${c}`); assert.ok(Math.abs(fr(r[2]) - M[c].moy) < 0.051, `moyenne ${c}`); }
  const sensRow = rows(cr).find((r) => r[0] === "Moyenne I + X + D par post");
  assert.ok(sensRow); ["A", "B", "C", "D", "AN", "BN", "CN"].forEach((c, i) => assert.ok(Math.abs(fr(sensRow[i + 1]) - S[c].moy) < 0.051, `sensibilité ${c}`));
});

test("le tableau par sujet du compte rendu = celui des résultats", () => {
  const cr = rows(read("compte-rendu/compte-rendu-E4.md")), main = rows(read("resultats/resultats.md"));
  const ref = main.filter((r) => /^S\d\d$/.test(r[0]) && r.length === 8).map((r) => r.slice(1).join(","));
  const mine = cr.filter((r) => /^\d+ /.test(r[0]) && r.length === 8).map((r) => r.slice(1).join(","));
  assert.equal(mine.length, 10);
  assert.deepEqual(mine, ref);
});
