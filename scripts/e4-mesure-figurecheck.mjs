// Mesure de lib/figureCheck.js sur les textes de E4. Lecture seule sur les données ; écrit dans docs/e4-chiffres/mesure-figurecheck/.
// Lancer : node scripts/e4-mesure-figurecheck.mjs   (protocole : docs/e4-chiffres/mesure-figurecheck/protocole-mesure.md)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { numberBase, figuresToCheck } from "../lib/figureCheck.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const E4 = path.join(ROOT, "docs/e4-chiffres");
// Sensibilité : --sans S04 exclut un sujet (résultats écrits dans un sous-dossier distinct)
const sansIdx = process.argv.indexOf("--sans");
const EXCLUDE = sansIdx > -1 ? process.argv.slice(sansIdx + 1) : [];
const OUT = path.join(E4, "mesure-figurecheck", EXCLUDE.length ? `sensibilite-sans-${EXCLUDE.join("-")}` : "");

const NUMBER_RE = /\d+(?:(?:[   ]\d{3}(?!\d))|(?:[.,]\d+))*/g;
const keyOf = (t) => t.replace(/\D/g, "");
const keysIn = (s) => [...String(s).matchAll(NUMBER_RE)].map((m) => keyOf(m[0]));
const norm = (s) => String(s).replace(/[’‘]/g, "'").replace(/[  ]/g, " ").replace(/\*+/g, "").replace(/\s+/g, " ").toLowerCase().trim();

// CSV à point-virgule, champs entre guillemets
function parseCsv(txt) {
  const rows = [];
  let row = [], cur = "", q = false;
  const s = txt.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ";") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0]);
}

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

// Fiches : corps de chaque section « ## Sn. », titre exclu
const fiches = {};
{
  const lines = fs.readFileSync(path.join(E4, "fiches-E4-fictives.md"), "utf8").split("\n");
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^## S(\d+)\./);
    if (m) { cur = "S" + String(m[1]).padStart(2, "0"); fiches[cur] = []; continue; }
    if (l.startsWith("## ") || l.trim() === "---") { cur = null; continue; }
    // l'étiquette « - F1. » est un repère de la fiche, pas une information : elle ne doit pas entrer dans la base de nombres
    if (cur && l.trim()) fiches[cur].push(l.replace(/^\s*-\s*F\d+\.\s*/, ""));
  }
}

const texts = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(E4, "anonymisation/textes-bruts-melanges.json"), "utf8")).map((t) => [t.id, t]));
const det = parseCsv(fs.readFileSync(path.join(E4, "resultats/detail-par-texte.csv"), "utf8"));
const cond = Object.fromEntries(det.slice(1).map((r) => [r[0], r[1]]));
const el = parseCsv(fs.readFileSync(path.join(E4, "classement/grille-elements-claude.csv"), "utf8")).slice(1)
  .map((r) => ({ id: r[0], n: r[1], citation: r[2], type: r[3], code: r[4] }));

const byText = {};
for (const e of el) (byText[e.id] ||= []).push(e);

const stats = {}; // par condition et "TOUT"
const bump = (c, k, v = 1) => { for (const g of [c, "TOUT"]) { stats[g] ||= {}; stats[g][k] = (stats[g][k] || 0) + v; } };
const detail = [["id_texte", "condition", "sujet", "n", "code", "type", "citation", "chiffre", "signale", "cause_si_non_signale", "localise"]];
let notLocated = 0;

for (const id of Object.keys(texts)) {
  const t = texts[id], c = cond[id], subj = t.subject;
  if (EXCLUDE.includes(subj)) continue;
  const base = numberBase([fiches[subj].join("\n")]);
  const baseKeys = new Set(base.filter((k) => !String(k).includes("|")));
  const body = norm(t.text);
  const alert = figuresToCheck(t.text, base); // plafond de six du produit
  const alertAll = figuresToCheck(t.text, base, Infinity);
  bump(c, "textes");
  const elems = byText[id] || [];
  const hasProblemNum = elems.some((e) => ["I", "X", "D"].includes(e.code) && /\d/.test(e.citation));
  const hasProblem = elems.some((e) => ["I", "X", "D"].includes(e.code));
  if (hasProblemNum) { bump(c, "textes_probleme_chiffre"); if (alert.length) bump(c, "textes_probleme_chiffre_alerte"); }
  if (!hasProblem) { bump(c, "textes_sans_probleme"); if (alert.length) bump(c, "textes_sans_probleme_alerte"); }
  if (alertAll.length > 6) bump(c, "textes_plus_de_6_signalements");
  bump(c, "signalements_total", alertAll.length);

  for (const e of elems) {
    const digit = /\d/.test(e.citation);
    if (!digit) {
      if (["I", "X", "D"].includes(e.code)) bump(c, "invisibles_" + e.code);
      detail.push([id, c, subj, e.n, e.code, e.type, e.citation, "non", "", "", ""]);
      continue;
    }
    const cit = norm(e.citation);
    let idx = body.indexOf(cit);
    if (idx < 0 && cit.length > 25) idx = body.indexOf(cit.slice(0, 25));
    const located = idx >= 0;
    if (!located) { notLocated++; bump(c, "citations_non_localisees"); }
    const ctx = located ? body.slice(idx, idx + cit.length + 16) : cit;
    const keys = new Set(keysIn(e.citation));
    // la clé d'un signalement est la partie numérique en tête de la chaîne affichée
    const isFlagged = figuresToCheck(ctx, base, Infinity).some((s) => keys.has(keyOf((s.match(NUMBER_RE) || [""])[0])));
    let cause = "";
    if (!isFlagged && ["I", "X", "D"].includes(e.code)) {
      const ks = [...keys];
      const ignored = ks.every((k) => (k.length === 4 && /^(19|20)\d\d$/.test(k)) || k.length < 2);
      cause = ks.some((k) => baseKeys.has(k)) ? "coincide_avec_la_fiche" : ignored ? "ignore_par_regle" : "autre";
    }
    bump(c, `chiffre_${e.code}`);
    if (isFlagged) bump(c, `chiffre_${e.code}_signale`);
    if (cause) bump(c, `FN_${e.code === "D" ? "D" : "IX"}_${cause}`);
    detail.push([id, c, subj, e.n, e.code, e.type, e.citation, "oui", isFlagged ? "oui" : "non", cause, located ? "oui" : "non"]);
  }
}

const order = ["A", "B", "C", "D", "AN", "BN", "CN", "TOUT"];
const g = (c, k) => stats[c]?.[k] || 0;
const pct = (a, b) => (b ? `${a} sur ${b} (${((100 * a) / b).toFixed(1)} %)` : `${a} sur ${b}`);
const meta = {
  date: new Date().toISOString(),
  figureCheck_sha256: sha(path.join(ROOT, "lib/figureCheck.js")),
  script_sha256: sha(fileURLToPath(import.meta.url)),
  grille_elements_sha256: sha(path.join(E4, "classement/grille-elements-claude.csv")),
  textes_sha256: sha(path.join(E4, "anonymisation/textes-bruts-melanges.json")),
};

let md = `# Mesure de « Chiffres à vérifier » sur E4 : résultats\n\n**Brouillon non publié, à relire.** Protocole : \`protocole-mesure.md\` (rédigé avant l'exécution). Un seul classeur, 70 textes, 10 sujets fictifs : voir les limites en bas.\n\n`;
md += `| Mesure | ${order.join(" | ")} |\n|---|${order.map(() => "---").join("|")}|\n`;
const row = (label, f) => (md += `| ${label} | ${order.map((c) => f(c)).join(" | ")} |\n`);
row("Textes", (c) => g(c, "textes"));
row("Chiffres I+X : signalés", (c) => pct(g(c, "chiffre_I_signale") + g(c, "chiffre_X_signale"), g(c, "chiffre_I") + g(c, "chiffre_X")));
row("Chiffres D : signalés", (c) => pct(g(c, "chiffre_D_signale"), g(c, "chiffre_D")));
row("Chiffres F signalés à tort", (c) => pct(g(c, "chiffre_F_signale"), g(c, "chiffre_F")));
row("Chiffres V (absents, vérifiés) signalés", (c) => pct(g(c, "chiffre_V_signale"), g(c, "chiffre_V")));
row("Textes avec un problème chiffré : alerte affichée", (c) => pct(g(c, "textes_probleme_chiffre_alerte"), g(c, "textes_probleme_chiffre")));
row("Textes sans aucun problème : alerte affichée", (c) => pct(g(c, "textes_sans_probleme_alerte"), g(c, "textes_sans_probleme")));
row("Problèmes invisibles (sans chiffre) I / X / D", (c) => `${g(c, "invisibles_I")} / ${g(c, "invisibles_X")} / ${g(c, "invisibles_D")}`);
row("Non signalés I+X : coïncide / ignoré / autre", (c) => `${g(c, "FN_IX_coincide_avec_la_fiche")} / ${g(c, "FN_IX_ignore_par_regle")} / ${g(c, "FN_IX_autre")}`);
row("Non signalés D : coïncide / ignoré / autre", (c) => `${g(c, "FN_D_coincide_avec_la_fiche")} / ${g(c, "FN_D_ignore_par_regle")} / ${g(c, "FN_D_autre")}`);
row("Textes avec plus de 6 signalements", (c) => g(c, "textes_plus_de_6_signalements"));
row("Citations non localisées", (c) => g(c, "citations_non_localisees"));
md += `\n## Reproductibilité\n\n\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\`\n\nLancer : \`node scripts/e4-mesure-figurecheck.mjs\`. Détail élément par élément : \`detail-elements.csv\`.\n\n## Limites\n- Un seul classeur, qui connaît le dispositif : aucun désaccord mesuré.\n- Entités et chiffres fictifs, 10 sujets, une génération par cas : pas de généralisation.\n- Les sujets S03, S05 et S10 n'ont aucun chiffre dans la fiche : tout nombre y est suspect par construction.\n- La condition A ne reçoit pas la fiche : pour elle, le contrôle est évalué contre la fiche que l'auteur aurait eue.\n- Le contrôle est indicatif et ne voit ni les noms, ni les durées en lettres, ni les citations (ligne « invisibles »).\n`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "resultats.md"), md);
fs.writeFileSync(path.join(OUT, "detail-elements.csv"), "﻿" + detail.map((r) => r.map((x) => (/[;"\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(";")).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "resultats.json"), JSON.stringify({ meta, stats }, null, 2));
console.log(md);
console.log("citations non localisées :", notLocated);
