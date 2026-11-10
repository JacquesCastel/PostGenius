#!/usr/bin/env node
// Test E4 : comparaison des deux classements indépendants (assistant et Jacques) AVANT l'ouverture de la clé d'anonymisation.
// Ce script ne lit JAMAIS la clé : il ne connaît pas les conditions. Voir protocole, section 6 (désaccords listés, tranchés à deux, jamais effacés).
//
// Entrées (par défaut dans docs/e4-chiffres/classement/) :
//   grille-elements-claude.csv  grille-elements-jacques.csv   (une ligne par élément relevé)
//   grille-textes-claude.csv    grille-textes-jacques.csv     (une ligne par texte : refus, chiffre absent)
// Sorties (dans docs/e4-chiffres/classement/comparaison/) :
//   rapport-comparaison.md        chiffres de l'accord et des désaccords (aucune condition)
//   desaccords.csv                chaque écart, à trancher à deux (colonnes « décision » à remplir)
//   grille-elements-finale.csv    éléments communs avec le code d'accord ; écarts laissés vides, à remplir (ou « ECART » pour exclure)
//   grille-textes-finale.csv      refus / chiffre absent, accords préremplis, écarts vides
//
// Usage :
//   node scripts/e4-compare.mjs
//   options : --dir <dossier> --claude-elements f --jacques-elements f --claude-textes f --jacques-textes f --out <dossier> --seuil 0.6
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const CODES = ["F", "D", "I", "V", "X", "G"];
export const UNSUPPORTED = ["I", "X", "D"]; // critère principal du protocole (section 5)

// ── CSV (point-virgule, guillemets, BOM) ────────────────────────────────────────────────────────────────────────────────────
export function parseCsv(text) {
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ";") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
export function toCsv(rows) {
  const esc = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n") + "\n";
}

// ── lecture des grilles ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function readElements(text, who) {
  const [, ...rows] = parseCsv(text); const out = []; const problems = [];
  for (const r of rows) {
    const [id, n, element, type, code, ligne, recherche, source, comment] = Array.from({ length: 9 }, (_, i) => (r[i] ?? "").trim());
    if (!id) continue;
    if (!/^T-[0-9A-Z]{4}$/.test(id)) { problems.push(`${who} : identifiant invalide « ${id} »`); continue; }
    const c = code.toUpperCase();
    if (!CODES.includes(c)) problems.push(`${who} : ${id} n°${n} « ${element.slice(0, 40)} » : code « ${code} » invalide (attendu ${CODES.join("/")})`);
    out.push({ id, n, element, type, code: c, ligne, recherche, source, comment, who });
  }
  return { elements: out, problems };
}
export function readTextes(text, who) {
  const [, ...rows] = parseCsv(text); const out = {}; const problems = [];
  for (const r of rows) {
    const [id, sujet, refus, absent, nb, remarques] = Array.from({ length: 6 }, (_, i) => (r[i] ?? "").trim());
    if (!id) continue;
    const yn = (v) => v.toLowerCase().replace(/\s.*$/, "");
    if (refus && !["oui", "non"].includes(yn(refus))) problems.push(`${who} : ${id} : refus « ${refus} » (oui/non attendu)`);
    out[id] = { id, sujet, refus: yn(refus), absent: yn(absent), nb, remarques };
  }
  return { textes: out, problems };
}

// ── appariement des éléments d'un même texte ────────────────────────────────────────────────────────────────────────────────
const STOP = new Set(["les", "des", "une", "par", "pour", "dans", "avec", "sur", "que", "qui", "est", "sont", "aux", "plus", "tous", "son", "ses", "leur", "ces", "cette", "dont", "mais", "pas", "elle", "nous", "vous", "notre", "nos"]);
export function tokens(s) {
  const t = String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").toLowerCase()
    .replace(/(\d)[\s  ](?=\d{3}(\D|$))/g, "$1").replace(/(\d),(\d)/g, "$1.$2");
  const all = t.match(/\d+(?:\.\d+)?|[a-z]{3,}/g) ?? [];
  return { nums: new Set(all.filter((x) => /^\d/.test(x))), words: new Set(all.filter((x) => !/^\d/.test(x) && !STOP.has(x))) };
}
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  const setA = new Set([...A.nums, ...A.words]), setB = new Set([...B.nums, ...B.words]);
  if (!setA.size || !setB.size) return 0;
  const inter = [...setA].filter((x) => setB.has(x)).length;
  let score = inter / Math.min(setA.size, setB.size);
  const numInter = [...A.nums].filter((x) => B.nums.has(x)).length;
  if (A.nums.size && B.nums.size && !numInter) return 0;           // deux nombres différents : jamais le même élément
  if ((A.nums.size === 0) !== (B.nums.size === 0)) score *= 0.5;   // l'un chiffré, l'autre pas
  return score;
}
// Appariement un-à-un glouton par score décroissant
export function matchElements(listA, listB, seuil = 0.6) {
  const pairs = [];
  listA.forEach((a, i) => listB.forEach((b, j) => { const s = similarity(a.element, b.element); if (s >= seuil) pairs.push({ i, j, s }); }));
  pairs.sort((x, y) => y.s - x.s || x.i - y.i || x.j - y.j);
  const usedA = new Set(), usedB = new Set(), matched = [];
  for (const p of pairs) if (!usedA.has(p.i) && !usedB.has(p.j)) { usedA.add(p.i); usedB.add(p.j); matched.push({ a: listA[p.i], b: listB[p.j], score: p.s }); }
  return { matched, onlyA: listA.filter((_, i) => !usedA.has(i)), onlyB: listB.filter((_, j) => !usedB.has(j)) };
}

export function kappa(pairs) {
  const n = pairs.length; if (!n) return null;
  const obs = pairs.filter((p) => p.a.code === p.b.code).length / n;
  const exp = CODES.reduce((s, c) => s + (pairs.filter((p) => p.a.code === c).length / n) * (pairs.filter((p) => p.b.code === c).length / n), 0);
  return exp === 1 ? 1 : (obs - exp) / (1 - exp);
}

export const tagOf = (c) => (String(c ?? "").match(/^\s*(CONSEIL|EXEMPLE|PLAN|DERIVE|STATISTIQUE)\b/i)?.[1] ?? "").toUpperCase();
const countUnsupported = (els) => els.filter((e) => UNSUPPORTED.includes(e.code)).length;

// ── comparaison complète ────────────────────────────────────────────────────────────────────────────────────────────────────
export function compare({ elA, elB, txA, txB, seuil = 0.6 }) {
  const ids = [...new Set([...Object.keys(txA), ...Object.keys(txB), ...elA.map((e) => e.id), ...elB.map((e) => e.id)])].sort();
  const perText = [], disagreements = [], finalEls = [], finalTx = [];
  const allPairs = [];
  for (const id of ids) {
    const a = elA.filter((e) => e.id === id), b = elB.filter((e) => e.id === id);
    const { matched, onlyA, onlyB } = matchElements(a, b, seuil);
    allPairs.push(...matched);
    let n = 0;
    for (const m of matched) {
      n++;
      const same = m.a.code === m.b.code;
      finalEls.push({ id, n, element: m.a.element, type: m.a.type || m.b.type, code: same ? m.a.code : "", origine: same ? "accord" : "désaccord de code", claude: m.a.code, jacques: m.b.code, motif: "", etiquette: tagOf(m.a.comment) || tagOf(m.b.comment) });
      if (!same) disagreements.push({ id, type: "code différent", claude: m.a, jacques: m.b });
    }
    for (const e of onlyA) { n++; finalEls.push({ id, n, element: e.element, type: e.type, code: "", origine: "relevé par l'assistant seul", claude: e.code, jacques: "", motif: "", etiquette: tagOf(e.comment) }); disagreements.push({ id, type: "relevé par l'assistant seul", claude: e, jacques: null }); }
    for (const e of onlyB) { n++; finalEls.push({ id, n, element: e.element, type: e.type, code: "", origine: "relevé par Jacques seul", claude: "", jacques: e.code, motif: "", etiquette: tagOf(e.comment) }); disagreements.push({ id, type: "relevé par Jacques seul", claude: null, jacques: e }); }
    const ta = txA[id], tb = txB[id];
    const fin = { id, sujet: (ta ?? tb)?.sujet ?? "", refus: "", absent: "", origine: [] };
    if (!ta || !tb) fin.origine.push("ligne absente d'une des deux grilles");
    else {
      for (const k of ["refus", "absent"]) {
        if (ta[k] === tb[k]) fin[k] = ta[k];
        else { fin.origine.push(`${k === "refus" ? "refus" : "chiffre absent"} : désaccord`); disagreements.push({ id, type: k === "refus" ? "refus différent" : "chiffre absent différent", claude: { element: `refus/absent « ${ta[k] || "(vide)"} »`, code: ta[k] }, jacques: { element: `« ${tb[k] || "(vide)"} »`, code: tb[k] } }); }
      }
    }
    finalTx.push(fin);
    perText.push({ id, sujet: fin.sujet, nA: a.length, nB: b.length, matched: matched.length, codeDiff: matched.filter((m) => m.a.code !== m.b.code).length, onlyA: onlyA.length, onlyB: onlyB.length, unsA: countUnsupported(a), unsB: countUnsupported(b) });
  }
  const sum = (k) => perText.reduce((s, t) => s + t[k], 0);
  const stats = {
    textes: perText.length, elementsClaude: sum("nA"), elementsJacques: sum("nB"), appariés: sum("matched"), codeDiff: sum("codeDiff"), seulClaude: sum("onlyA"), seulJacques: sum("onlyB"),
    accordCode: allPairs.length ? 1 - sum("codeDiff") / allPairs.length : null, kappa: kappa(allPairs),
    textesCritereDiff: perText.filter((t) => t.unsA !== t.unsB).length,
    ecartMoyenCritere: perText.length ? perText.reduce((s, t) => s + Math.abs(t.unsA - t.unsB), 0) / perText.length : 0,
    desaccordsTotal: disagreements.length,
    desaccordsParType: disagreements.reduce((o, d) => ((o[d.type] = (o[d.type] ?? 0) + 1), o), {}),
  };
  return { perText, disagreements, finalEls, finalTx, stats };
}

export function validate(elA, elB, txA, txB, problems = []) {
  const out = [...problems];
  for (const [who, tx] of [["assistant", txA], ["Jacques", txB]]) if (Object.keys(tx).length !== 70) out.push(`${who} : ${Object.keys(tx).length} texte(s) dans la grille des textes (70 attendus)`);
  const idsA = new Set(Object.keys(txA)), idsB = new Set(Object.keys(txB));
  for (const id of idsA) if (!idsB.has(id)) out.push(`texte ${id} absent de la grille de Jacques`);
  for (const id of idsB) if (!idsA.has(id)) out.push(`texte ${id} absent de la grille de l'assistant`);
  for (const [who, els, tx] of [["assistant", elA, txA], ["Jacques", elB, txB]]) for (const e of els) if (!tx[e.id]) out.push(`${who} : élément pour un texte inconnu (${e.id})`);
  return out;
}

export function reportMarkdown({ stats, perText }, problems) {
  const p = (x) => (x == null ? "n/a" : `${(x * 100).toFixed(1)} %`);
  let md = `# E4 : comparaison des deux classements (avant ouverture de la clé)\n\nAucune condition n'est connue de ce rapport. Chiffres publiables tels quels dans le compte rendu.\n\n`;
  if (problems.length) md += `## À corriger avant de conclure\n\n${problems.map((x) => `- ${x}`).join("\n")}\n\n`;
  md += `## Accord\n\n| | |\n|---|---|\n| Textes classés | ${stats.textes} |\n| Éléments relevés par l'assistant | ${stats.elementsClaude} |\n| Éléments relevés par Jacques | ${stats.elementsJacques} |\n| Éléments relevés par les deux (appariés) | ${stats.appariés} |\n| Appariés avec un **code différent** | ${stats.codeDiff} |\n| Relevés par l'assistant seul | ${stats.seulClaude} |\n| Relevés par Jacques seul | ${stats.seulJacques} |\n| Accord sur le code (parmi les appariés) | ${p(stats.accordCode)} |\n| Kappa de Cohen (parmi les appariés) | ${stats.kappa == null ? "n/a" : stats.kappa.toFixed(2)} |\n| Textes dont le critère principal (I + X + D) diffère | ${stats.textesCritereDiff} sur ${stats.textes} |\n| Écart moyen absolu du critère principal par texte | ${stats.ecartMoyenCritere.toFixed(2)} |\n\n## Désaccords à trancher à deux : ${stats.desaccordsTotal}\n\n${Object.entries(stats.desaccordsParType).map(([k, v]) => `- ${k} : ${v}`).join("\n") || "- aucun"}\n\nListe détaillée dans \`desaccords.csv\` ; à remplir dans \`grille-elements-finale.csv\` et \`grille-textes-finale.csv\`.\n\n## Textes avec écart (critère principal ou désaccords)\n\n| Texte | Sujet | Éléments assistant | Éléments Jacques | Appariés | Codes différents | Seul assistant | Seul Jacques | I+X+D assistant | I+X+D Jacques |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const t of perText.filter((t) => t.codeDiff || t.onlyA || t.onlyB || t.unsA !== t.unsB)) md += `| ${t.id} | ${t.sujet} | ${t.nA} | ${t.nB} | ${t.matched} | ${t.codeDiff} | ${t.onlyA} | ${t.onlyB} | ${t.unsA} | ${t.unsB} |\n`;
  return md;
}

function parseArgs(argv) {
  const a = { dir: path.join(ROOT, "docs/e4-chiffres/classement"), seuil: 0.6 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dir") a.dir = path.resolve(argv[++i]);
    else if (k === "--out") a.out = path.resolve(argv[++i]);
    else if (k === "--seuil") a.seuil = Number(argv[++i]);
    else if (k === "--claude-elements") a.ce = argv[++i];
    else if (k === "--jacques-elements") a.je = argv[++i];
    else if (k === "--claude-textes") a.ct = argv[++i];
    else if (k === "--jacques-textes") a.jt = argv[++i];
    else throw new Error(`Option inconnue : ${k}`);
  }
  a.ce ??= path.join(a.dir, "grille-elements-claude.csv"); a.je ??= path.join(a.dir, "grille-elements-jacques.csv");
  a.ct ??= path.join(a.dir, "grille-textes-claude.csv"); a.jt ??= path.join(a.dir, "grille-textes-jacques.csv");
  a.out ??= path.join(a.dir, "comparaison");
  return a;
}

export function run(a) {
  for (const f of [a.ce, a.je, a.ct, a.jt]) if (!fs.existsSync(f)) throw new Error(`Fichier introuvable : ${f}`);
  const e1 = readElements(fs.readFileSync(a.ce, "utf8"), "assistant"), e2 = readElements(fs.readFileSync(a.je, "utf8"), "Jacques");
  const t1 = readTextes(fs.readFileSync(a.ct, "utf8"), "assistant"), t2 = readTextes(fs.readFileSync(a.jt, "utf8"), "Jacques");
  const problems = validate(e1.elements, e2.elements, t1.textes, t2.textes, [...e1.problems, ...e2.problems, ...t1.problems, ...t2.problems]);
  const res = compare({ elA: e1.elements, elB: e2.elements, txA: t1.textes, txB: t2.textes, seuil: a.seuil });
  fs.mkdirSync(a.out, { recursive: true });
  fs.writeFileSync(path.join(a.out, "rapport-comparaison.md"), reportMarkdown(res, problems));
  fs.writeFileSync(path.join(a.out, "desaccords.csv"), toCsv([
    ["id_texte", "type d'écart", "élément (assistant)", "code assistant", "recherche / source assistant", "élément (Jacques)", "code Jacques", "recherche / source Jacques", "décision à deux", "code final (F/D/I/V/X/G ou ECART)", "motif"],
    ...res.disagreements.map((d) => [d.id, d.type, d.claude?.element ?? "", d.claude?.code ?? "", [d.claude?.recherche, d.claude?.source].filter(Boolean).join(" | "), d.jacques?.element ?? "", d.jacques?.code ?? "", [d.jacques?.recherche, d.jacques?.source].filter(Boolean).join(" | "), "", "", ""]),
  ]));
  fs.writeFileSync(path.join(a.out, "grille-elements-finale.csv"), toCsv([
    ["id_texte", "n", "élément", "type", "code final (F/D/I/V/X/G ou ECART)", "origine", "code assistant", "code Jacques", "motif", "étiquette"],
    ...res.finalEls.map((e) => [e.id, e.n, e.element, e.type, e.code, e.origine, e.claude, e.jacques, e.motif, e.etiquette]),
  ]));
  fs.writeFileSync(path.join(a.out, "grille-textes-finale.csv"), toCsv([
    ["id_texte", "sujet", "refus_ou_pas_de_donnee (oui/non)", "chiffre_absent_de_la_fiche (oui/non/sans objet)", "origine"],
    ...res.finalTx.map((t) => [t.id, t.sujet, t.refus, t.absent, t.origine.join(" ; ") || "accord"]),
  ]));
  return { res, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const { res, problems } = run(a);
    const s = res.stats;
    console.log(`✓ ${s.textes} textes ; éléments : assistant ${s.elementsClaude}, Jacques ${s.elementsJacques}, appariés ${s.appariés}.`);
    console.log(`  Désaccords à trancher à deux : ${s.desaccordsTotal} (${Object.entries(s.desaccordsParType).map(([k, v]) => `${k} : ${v}`).join(" ; ") || "aucun"}).`);
    console.log(`  Accord sur le code : ${s.accordCode == null ? "n/a" : (s.accordCode * 100).toFixed(1) + " %"} ; kappa ${s.kappa == null ? "n/a" : s.kappa.toFixed(2)}.`);
    if (problems.length) { console.log(`\n! ${problems.length} point(s) à corriger dans les grilles :`); problems.slice(0, 20).forEach((p) => console.log("  - " + p)); }
    console.log(`  Fichiers : ${a.out}`);
  } catch (e) { console.error("Erreur :", e.message); process.exit(1); }
}
