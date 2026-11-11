// E4 : répartition par type de fait (chiffre, date, nom propre, citation, source) des éléments relevés et des éléments non supportés (I + X + D).
// Lecture seule : classement/grille-elements-claude.csv + resultats/detail-par-texte.csv. Écrit docs/e4-chiffres/resultats/types-de-faits.md.
//   node scripts/e4-types.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const E4 = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs/e4-chiffres");
function parseCsv(txt) {
  const rows = []; let row = [], cur = "", q = false;
  for (const [i, c] of [...txt.replace(/^﻿/, "")].entries()) { void i; if (q) { if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ";") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c !== "\r") cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}
const cond = Object.fromEntries(parseCsv(fs.readFileSync(path.join(E4, "resultats/detail-par-texte.csv"), "utf8")).slice(1).map((r) => [r[0], r[1]]));
const elements = parseCsv(fs.readFileSync(path.join(E4, "classement/grille-elements-claude.csv"), "utf8")).slice(1).map((r) => ({ id: r[0], type: r[3], code: r[4] }));
const TYPES = [["chiffre", "Chiffres, pourcentages, montants"], ["date", "Dates et durées"], ["nom", "Noms propres"], ["citation", "Citations"], ["source", "Études et sources citées"]];
const CONDS = ["A", "B", "C", "D", "AN", "BN", "CN"];
const relevés = {}, bad = {};
for (const e of elements) {
  const c = cond[e.id];
  relevés[e.type] = (relevés[e.type] ?? 0) + 1;
  if (["I", "X", "D"].includes(e.code)) { bad[e.type] = (bad[e.type] ?? 0) + 1; (bad[`${c}:${e.type}`] ??= 0); bad[`${c}:${e.type}`]++; }
}
const total = elements.length, totalBad = TYPES.reduce((s, [t]) => s + (bad[t] ?? 0), 0);
let md = `# E4 : types de faits relevés et non supportés\n\nGénéré par \`scripts/e4-types.mjs\` à partir de \`classement/grille-elements-claude.csv\` (un seul classeur) et de \`resultats/detail-par-texte.csv\`. Éléments non supportés = codes I + X + D.\n\n| Type de fait | Relevés | Inventés ou déformés |\n|---|---|---|\n`;
for (const [t, label] of TYPES) md += `| ${label} | ${relevés[t] ?? 0} | ${bad[t] ?? 0} |\n`;
md += `| **Total** | **${total}** | **${totalBad}** |\n\n### Non supportés par type et par condition\n\n| Condition | ${TYPES.map(([, l]) => l).join(" | ")} | Total |\n|---|${TYPES.map(() => "---").join("|")}|---|\n`;
for (const c of CONDS) md += `| ${c} | ${TYPES.map(([t]) => bad[`${c}:${t}`] ?? 0).join(" | ")} | ${TYPES.reduce((s, [t]) => s + (bad[`${c}:${t}`] ?? 0), 0)} |\n`;
md += `\nLimite : les citations et les sources sont rares dans ces textes (${(relevés.citation ?? 0) + (relevés.source ?? 0)} sur ${total} faits relevés) : ce test ne permet presque rien de dire sur l'invention d'une citation ou d'une étude.\n`;
fs.writeFileSync(path.join(E4, "resultats/types-de-faits.md"), md);
console.log(md);
