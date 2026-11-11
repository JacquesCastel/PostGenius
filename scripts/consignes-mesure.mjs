// Mesure du contrôle des consignes (lib/consigneRules.js). Lecture seule.
//   node scripts/consignes-mesure.mjs                    corpus étiqueté (docs/consignes-mesure/corpus.csv)
//   node scripts/consignes-mesure.mjs --export f.csv     consignes réelles exportées (champ;texte) : règles obtenues, à relire à la main
// Protocole : docs/consignes-mesure/protocole.md
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { deriveConsigneRules } from "../lib/consigneRules.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "docs/consignes-mesure");

function parseCsv(txt) {
  const rows = [];
  let row = [], cur = "", q = false;
  const s = txt.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ";") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0]);
}
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const tokensOf = (rules) => rules.filter((r) => ["noEmoji", "maxHashtags", "address", "endsWithQuestion"].includes(r.kind)).map((r) => (r.kind === "maxHashtags" ? `maxHashtags:${r.value}` : r.kind === "address" ? `address:${r.side}` : r.kind));
const derive = (text, lang = "fr") => tokensOf(deriveConsigneRules({ sources: [{ origin: "Consignes", text }], language: lang }));

const exportIdx = process.argv.indexOf("--export");
if (exportIdx > -1) {
  const rows = parseCsv(fs.readFileSync(process.argv[exportIdx + 1], "utf8")).slice(1);
  let withRule = 0;
  console.log("champ;règles obtenues;texte");
  for (const [champ, texte] of rows) {
    const t = derive(texte);
    if (t.length) withRule++;
    console.log(`${champ};${t.join("|") || "(aucune)"};${JSON.stringify(texte)}`);
  }
  console.log(`\n${rows.length} consignes, ${withRule} avec au moins une règle contrôlée. À relire à la main : une règle manquante ou en trop est à noter.`);
  process.exit(0);
}

const corpus = parseCsv(fs.readFileSync(path.join(DIR, "corpus.csv"), "utf8")).slice(1).map(([id, source, texte, attendu, note]) => ({ id, source, texte, attendu: (attendu || "").split("|").filter(Boolean), note: note || "" }));
const UNSUPPORTED = new Set(["terms"]); // « terminer par une question » est pris en charge depuis l'exécution 3
const groups = { reel: (r) => !r.id.startsWith("S"), synthetique: (r) => r.id.startsWith("S") };
const detail = [["id", "source", "attendu", "obtenu", "retrouvé", "manquant", "en_trop", "texte"]];
const agg = {};
for (const r of corpus) {
  const got = derive(r.texte);
  const found = r.attendu.filter((a) => got.includes(a));
  const missing = r.attendu.filter((a) => !got.includes(a));
  const extra = got.filter((g) => !r.attendu.includes(g));
  detail.push([r.id, r.source, r.attendu.join("|"), got.join("|"), found.join("|"), missing.join("|"), extra.join("|"), r.texte.replace(/\n/g, " ")]);
  for (const [name, f] of Object.entries(groups)) {
    if (!f(r)) continue;
    const a = (agg[name] ||= { consignes: 0, attendues: 0, retrouvees: 0, manquantes_prises_en_charge: [], non_prises_en_charge: [], en_trop: [], sans_regle_ok: 0, sans_regle_total: 0 });
    a.consignes++;
    a.attendues += r.attendu.length;
    a.retrouvees += found.length;
    for (const m of missing) (UNSUPPORTED.has(m) ? a.non_prises_en_charge : a.manquantes_prises_en_charge).push(`${r.id} ${m}`);
    for (const e of extra) a.en_trop.push(`${r.id} ${e}`);
    if (!r.attendu.length) { a.sans_regle_total++; if (!got.length) a.sans_regle_ok++; }
  }
}
const pct = (a, b) => (b ? `${a} sur ${b} (${((100 * a) / b).toFixed(1)} %)` : `${a} sur ${b}`);
const meta = { date: new Date().toISOString(), consigneRules_sha256: sha(path.join(ROOT, "lib/consigneRules.js")), corpus_sha256: sha(path.join(DIR, "corpus.csv")), script_sha256: sha(fileURLToPath(import.meta.url)) };
let md = `# Mesure du contrôle des consignes : résultats\n\n**Brouillon.** Protocole : \`protocole.md\` (rédigé avant l'exécution). Étiqueteur unique, qui est aussi l'auteur du contrôle.\n\n`;
for (const [name, a] of Object.entries(agg)) {
  const prises = a.attendues - a.non_prises_en_charge.length;
  md += `## ${name === "reel" ? "Consignes réelles du dépôt (R01 à R10)" : "Formulations synthétiques (S01 à S34)"}\n\n`;
  md += `- Consignes : ${a.consignes}\n- Règles attendues retrouvées : ${pct(a.retrouvees, a.attendues)}\n- Dont règles du type pris en charge (émoji, hashtags, tutoiement/vouvoiement, question finale) : ${pct(a.retrouvees, prises)}\n`;
  md += `- Manquantes, type pris en charge : ${a.manquantes_prises_en_charge.length ? a.manquantes_prises_en_charge.join(" ; ") : "aucune"}\n- Type non pris en charge (mot interdit en texte libre) : ${a.non_prises_en_charge.length ? a.non_prises_en_charge.join(" ; ") : "aucune"}\n`;
  md += `- **Fausses règles** (produites sans être attendues) : ${a.en_trop.length ? a.en_trop.join(" ; ") : "aucune"}\n- Consignes sans règle attendue, et aucune règle produite : ${pct(a.sans_regle_ok, a.sans_regle_total)}\n\n`;
}
md += `## Reproductibilité\n\n\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\`\n\nDétail : \`detail.csv\`. Relancer : \`node scripts/consignes-mesure.mjs\`.\n\n## Limites\n- Un seul étiqueteur, auteur du contrôle ; corpus réel minuscule (10 consignes, toutes du dépôt) ; formulations synthétiques écrites par le même auteur.\n- Aucune consigne d'un vrai compte : voir \`export-consignes.sql\`.\n- La « voix de la marque » (\`brandVoice\`) est lue par la route \`/api/consignes\` pour un post de page ; ce corpus ne la teste que sur le texte (R07), pas la lecture du champ.\n`;
fs.writeFileSync(path.join(DIR, "resultats.md"), md);
fs.writeFileSync(path.join(DIR, "detail.csv"), "﻿" + detail.map((r) => r.map((x) => (/[;"\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(";")).join("\n") + "\n");
console.log(md);
