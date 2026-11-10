#!/usr/bin/env node
// Test E4 : calcul des résultats par condition et application des règles de décision du protocole (sections 5, 7 et 8).
// À lancer UNE FOIS, après la réconciliation des deux classements : ce script lit la clé d'anonymisation et révèle donc les conditions.
//
// Entrées (par défaut) :
//   docs/e4-chiffres/classement/comparaison/grille-elements-finale.csv   (code final de chaque élément, ECART pour exclure)
//   docs/e4-chiffres/classement/comparaison/grille-textes-finale.csv     (refus, chiffre absent)
//   docs/e4-chiffres/anonymisation/NE-PAS-OUVRIR-avant-classement/cle-anonymisation.json
// Sorties (docs/e4-chiffres/resultats/) : resultats.md, detail-par-texte.csv
//
// Usage : node scripts/e4-resultats.mjs [--sans-etiquettes CONSEIL,EXEMPLE,PLAN] [--out dossier]
//   --sans-etiquettes : analyse de sensibilité (retire du calcul les éléments portant ces étiquettes) ; ne remplace JAMAIS l'analyse principale.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseCsv, CODES, UNSUPPORTED } from "./e4-compare.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const CHIFFREES = ["A", "B", "C", "D"];
export const NEUTRES = ["AN", "BN", "CN"];
export const SUJETS_SANS_CHIFFRE = ["S03", "S05", "S10"];
// Seuils figés par le protocole (section 7) : « nettement » = écart moyen d'au moins 2 éléments par post ; « ≈ » = écart ≤ 1 élément en moyenne.
export const SEUIL_NETTEMENT = 2;
export const SEUIL_EQUIVALENT = 1;

export const PHRASES = {
  C_PIRE: "« Dans notre test, LinkeePost n'a pas fait mieux qu'un assistant généraliste auquel on fournit les mêmes faits. » + l'analyse des causes",
  C_EGAL_B: "« Dans notre test, fournir les faits a eu plus d'effet que l'outil utilisé. »",
  INVITE: "« L'écart vient de l'invite de LinkeePost, pas du modèle », avec la limite de 10 sujets",
  MODELE: "« L'écart vient surtout du modèle ou de la méthode, pas du produit »",
  SANS_CHIFFRE: (n) => `« LinkeePost a inventé un élément dans ${n} cas sur 3 sans données chiffrées. » (présentation de l'exemple)`,
  ZERO: "« Aucun dans nos 10 sujets, ce qui ne prouve pas qu'il n'en produit jamais. »",
};

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "n/a");

// ── lecture ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function rowsAsObjects(text) {
  const [head, ...rows] = parseCsv(text);
  const norm = (h) => h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const keys = head.map(norm);
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
export function readFinalElements(text) {
  return rowsAsObjects(text).filter((r) => r["id_texte"]).map((r) => ({
    id: r["id_texte"], n: r["n"], element: r["element"], code: (r["code final (f/d/i/v/x/g ou ecart)"] ?? "").toUpperCase(), etiquette: (r["etiquette"] ?? "").toUpperCase(),
  }));
}
export function readFinalTextes(text) {
  const out = {};
  for (const r of rowsAsObjects(text)) if (r["id_texte"]) out[r["id_texte"]] = { id: r["id_texte"], sujet: r["sujet"], refus: r["refus_ou_pas_de_donnee (oui/non)"].toLowerCase(), absent: r["chiffre_absent_de_la_fiche (oui/non/sans objet)"].toLowerCase() };
  return out;
}

// Contrôles : aucune case vide, tout est apparié à la clé. Renvoie la liste des problèmes (vide = on peut calculer).
export function check(elements, textes, key) {
  const p = [];
  if (key.length !== 70) p.push(`clé : ${key.length} textes (70 attendus)`);
  const ids = new Set(key.map((k) => k.id));
  for (const k of key) if (!textes[k.id]) p.push(`texte ${k.id} absent de grille-textes-finale.csv`);
  for (const id of Object.keys(textes)) if (!ids.has(id)) p.push(`texte ${id} inconnu de la clé`);
  for (const e of elements) {
    if (!ids.has(e.id)) p.push(`élément pour un texte inconnu : ${e.id}`);
    else if (e.code === "") p.push(`${e.id} n°${e.n} « ${e.element.slice(0, 40)} » : code final vide (désaccord non tranché)`);
    else if (![...CODES, "ECART"].includes(e.code)) p.push(`${e.id} n°${e.n} : code final « ${e.code} » invalide`);
  }
  for (const t of Object.values(textes)) {
    if (!["oui", "non"].includes(t.refus)) p.push(`${t.id} : refus « ${t.refus} » non tranché (oui/non attendu)`);
    if (SUJETS_SANS_CHIFFRE.includes(t.sujet) && !["oui", "non"].includes(t.absent)) p.push(`${t.id} (${t.sujet}) : « chiffre absent » « ${t.absent} » non tranché`);
  }
  return p;
}

// ── calcul ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function computePerText(elements, textes, key, { sansEtiquettes = [] } = {}) {
  const excl = new Set(sansEtiquettes.map((x) => x.toUpperCase()));
  return key.map((k) => {
    const els = elements.filter((e) => e.id === k.id && e.code !== "ECART" && !(e.etiquette && excl.has(e.etiquette)));
    const c = Object.fromEntries(CODES.map((x) => [x, els.filter((e) => e.code === x).length]));
    const t = textes[k.id] ?? {};
    return { id: k.id, condition: k.condition, subject: k.subject, ...c, nonSupportes: UNSUPPORTED.reduce((s, x) => s + c[x], 0), refus: t.refus === "oui", absent: t.absent === "oui", ixSeul: c.I + c.X };
  });
}
export function byCondition(perText) {
  const out = {};
  for (const cond of [...CHIFFREES, ...NEUTRES]) {
    const rows = perText.filter((r) => r.condition === cond);
    out[cond] = {
      n: rows.length, moyenne: mean(rows.map((r) => r.nonSupportes)), total: rows.reduce((s, r) => s + r.nonSupportes, 0),
      partAvec1: rows.length ? rows.filter((r) => r.nonSupportes >= 1).length / rows.length : NaN, avec1: rows.filter((r) => r.nonSupportes >= 1).length,
      V: rows.reduce((s, r) => s + r.V, 0), G: rows.reduce((s, r) => s + r.G, 0), F: rows.reduce((s, r) => s + r.F, 0), refus: rows.filter((r) => r.refus).length,
      sansChiffre: SUJETS_SANS_CHIFFRE.map((s) => rows.find((r) => r.subject === s)).filter(Boolean),
    };
  }
  return out;
}
const sujetsPar = (perText, cond) => Object.fromEntries(perText.filter((r) => r.condition === cond).map((r) => [r.subject, r.nonSupportes]));
export function pairedDiff(perText, c1, c2) {
  const a = sujetsPar(perText, c1), b = sujetsPar(perText, c2);
  const subjects = Object.keys(a).filter((s) => s in b).sort();
  const d = subjects.map((s) => a[s] - b[s]);
  return { subjects, diffs: d, moyenne: mean(d), moins: d.filter((x) => x < 0).length, egal: d.filter((x) => x === 0).length, plus: d.filter((x) => x > 0).length, min: Math.min(...d), max: Math.max(...d) };
}

// ── règles de décision (protocole, section 7) ───────────────────────────────────────────────────────────────────────────────
// Interprétation à valider AVANT l'ouverture de la clé : voir docs/e4-chiffres/regles-decision-interpretation.md
export function decide(cond, perText) {
  const m = (c) => cond[c].moyenne;
  const dCB = m("C") - m("B"), dDB = m("D") - m("B");
  const lines = [], notes = [];
  // Lignes 1 à 4 (comparaison C / B, puis D / B)
  if (dCB > SEUIL_EQUIVALENT) lines.push({ ligne: 1, vrai: true, phrase: PHRASES.C_PIRE, detail: `C − B = ${f2(dCB)} > ${SEUIL_EQUIVALENT}` });
  else if (Math.abs(dCB) <= SEUIL_EQUIVALENT) lines.push({ ligne: 2, vrai: true, phrase: PHRASES.C_EGAL_B, detail: `|C − B| = ${f2(Math.abs(dCB))} ≤ ${SEUIL_EQUIVALENT}` });
  else if (-dCB >= SEUIL_NETTEMENT) {
    if (Math.abs(dDB) <= SEUIL_EQUIVALENT) lines.push({ ligne: 3, vrai: true, phrase: PHRASES.INVITE, detail: `B − C = ${f2(-dCB)} ≥ ${SEUIL_NETTEMENT} et |D − B| = ${f2(Math.abs(dDB))} ≤ ${SEUIL_EQUIVALENT}` });
    else if (-dDB >= SEUIL_NETTEMENT) lines.push({ ligne: 4, vrai: true, phrase: PHRASES.MODELE, detail: `B − C = ${f2(-dCB)} ≥ ${SEUIL_NETTEMENT} et B − D = ${f2(-dDB)} ≥ ${SEUIL_NETTEMENT}` });
    else notes.push(`C est nettement meilleur que B (B − C = ${f2(-dCB)}) mais D − B = ${f2(dDB)} n'est ni ≈ B (|écart| ≤ ${SEUIL_EQUIVALENT}) ni nettement meilleur (≥ ${SEUIL_NETTEMENT}) : aucune ligne du protocole ne s'applique pour D ; écrire les chiffres sans formule.`);
    if (dDB > SEUIL_EQUIVALENT) notes.push(`D est pire que B (D − B = ${f2(dDB)}) : cas non prévu par les lignes 3 et 4 ; écrire les chiffres sans formule pour D.`);
  } else notes.push(`B − C = ${f2(-dCB)} est entre ${SEUIL_EQUIVALENT} et ${SEUIL_NETTEMENT} : ni « ≈ » ni « nettement » ; aucune ligne du protocole ne s'applique ; écrire les chiffres sans formule.`);
  // Ligne 5 : au moins un I ou X en C sur 3, 5, 10
  const cSans = cond.C.sansChiffre;
  const n = cSans.filter((r) => r.ixSeul >= 1).length;
  if (n >= 1) lines.push({ ligne: 5, vrai: true, phrase: PHRASES.SANS_CHIFFRE(n), detail: `sujets ${cSans.filter((r) => r.ixSeul >= 1).map((r) => r.subject).join(", ")}` });
  // Ligne 6 : zéro élément non supporté partout en C
  if (cond.C.total === 0) lines.push({ ligne: 6, vrai: true, phrase: PHRASES.ZERO, detail: "0 élément non supporté dans les 10 textes de C" });
  return { dCB, dDB, lines, notes };
}

// ── rapport ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function report({ perText, cond, decision, disagreements, sensibilite, key }) {
  const L = [];
  const sujets = [...new Set(perText.map((r) => r.subject))].sort();
  L.push(`# E4 : résultats${sensibilite ? ` (ANALYSE DE SENSIBILITÉ, sans les étiquettes ${sensibilite.join(", ")})` : ""}`, "");
  L.push("Test non scientifique : 10 sujets, 1 génération par cas, deux classeurs dont l'un n'était pas aveugle. Critère principal : nombre d'éléments I + X + D par post.", "");
  if (sensibilite) L.push("> Cette analyse retire des éléments du calcul : elle ne remplace pas l'analyse principale et ne fixe aucune conclusion.", "");
  L.push("## Critère principal par condition", "", "| Condition | Textes | Moyenne I+X+D par post | Total | Posts avec ≥ 1 | Éléments V | Refus |", "|---|---|---|---|---|---|---|");
  for (const c of [...CHIFFREES, ...NEUTRES]) { const x = cond[c]; L.push(`| ${c} | ${x.n} | **${f2(x.moyenne)}** | ${x.total} | ${x.avec1} sur ${x.n} (${f2(x.partAvec1 * 100)} %) | ${x.V} | ${x.refus} |`); }
  L.push("", "## Tableau complet : I + X + D par sujet et par condition", "", `| Sujet | ${[...CHIFFREES, ...NEUTRES].join(" | ")} |`, `|---|${[...CHIFFREES, ...NEUTRES].map(() => "---").join("|")}|`);
  for (const s of sujets) L.push(`| ${s} | ${[...CHIFFREES, ...NEUTRES].map((c) => perText.find((r) => r.condition === c && r.subject === s)?.nonSupportes ?? "·").join(" | ")} |`);
  L.push("", "## Écarts par paires de sujets (moyenne des écarts, nombre de sujets en faveur de chaque condition)", "", "| Comparaison | Écart moyen | Sujets où le premier a moins | égalité | où il a plus | min | max |", "|---|---|---|---|---|---|---|");
  for (const [a, b] of [["C", "B"], ["D", "B"], ["B", "A"], ["C", "D"], ["BN", "AN"], ["CN", "BN"]]) { const d = pairedDiff(perText, a, b); L.push(`| ${a} − ${b} | ${f2(d.moyenne)} | ${d.moins} | ${d.egal} | ${d.plus} | ${d.min} | ${d.max} |`); }
  L.push("", "## Sujets 3, 5, 10 (aucun chiffre dans la fiche)", "", "| Condition | Sujet | I + X | Chiffre absent de la fiche | Refus |", "|---|---|---|---|---|");
  for (const c of [...CHIFFREES, ...NEUTRES]) for (const r of cond[c].sansChiffre) L.push(`| ${c} | ${r.subject} | ${r.ixSeul} | ${r.absent ? "oui" : "non"} | ${r.refus ? "oui" : "non"} |`);
  L.push("", "## Règles de décision (protocole, section 7)", "", `Écart C − B = **${f2(decision.dCB)}** ; écart D − B = **${f2(decision.dDB)}** (moyennes par post, conditions chiffrées).`, "");
  if (!decision.lines.length) L.push("Aucune ligne de la table du protocole ne s'applique telle quelle.", "");
  for (const l of decision.lines) L.push(`- **Ligne ${l.ligne}** (${l.detail}) : ${l.phrase}`);
  for (const n of decision.notes) L.push(`- ⚠ ${n}`);
  L.push("", "Les chiffres ci-dessus sont publiés dans tous les cas, y compris les résultats défavorables à LinkeePost.", "");
  if (disagreements != null) L.push("## Désaccords entre classeurs", "", `${disagreements} désaccord(s) listé(s) puis tranché(s) à deux (voir \`classement/comparaison/desaccords.csv\`).`, "");
  return L.join("\n");
}

export function detailCsv(perText) {
  const esc = (v) => String(v);
  const head = ["id_texte", "condition", "sujet", ...CODES, "I+X+D", "refus", "chiffre_absent"];
  return "﻿" + [head, ...perText.sort((a, b) => a.condition.localeCompare(b.condition) || a.subject.localeCompare(b.subject)).map((r) => [r.id, r.condition, r.subject, ...CODES.map((c) => r[c]), r.nonSupportes, r.refus ? "oui" : "non", r.absent ? "oui" : "non"])].map((r) => r.map(esc).join(";")).join("\n") + "\n";
}

function parseArgs(argv) {
  const base = path.join(ROOT, "docs/e4-chiffres");
  const a = { elements: path.join(base, "classement/comparaison/grille-elements-finale.csv"), textes: path.join(base, "classement/comparaison/grille-textes-finale.csv"), cle: path.join(base, "anonymisation/NE-PAS-OUVRIR-avant-classement/cle-anonymisation.json"), desaccords: path.join(base, "classement/comparaison/desaccords.csv"), out: path.join(base, "resultats"), sans: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--sans-etiquettes") a.sans = argv[++i].split(",").map((x) => x.trim()).filter(Boolean);
    else if (k === "--out") a.out = path.resolve(argv[++i]);
    else if (k === "--elements") a.elements = argv[++i];
    else if (k === "--textes") a.textes = argv[++i];
    else if (k === "--cle") a.cle = argv[++i];
    else throw new Error(`Option inconnue : ${k}`);
  }
  return a;
}

export function run(a) {
  for (const f of [a.elements, a.textes, a.cle]) if (!fs.existsSync(f)) throw new Error(`Fichier introuvable : ${f}`);
  const elements = readFinalElements(fs.readFileSync(a.elements, "utf8")), textes = readFinalTextes(fs.readFileSync(a.textes, "utf8"));
  const keyRaw = fs.readFileSync(a.cle, "utf8"), key = JSON.parse(keyRaw);
  const problems = check(elements, textes, key);
  if (problems.length) return { problems };
  const perText = computePerText(elements, textes, key, { sansEtiquettes: a.sans });
  const cond = byCondition(perText), decision = decide(cond, perText);
  let dis = null; if (fs.existsSync(a.desaccords)) dis = Math.max(0, parseCsv(fs.readFileSync(a.desaccords, "utf8")).length - 1);
  const md = report({ perText, cond, decision, disagreements: dis, sensibilite: a.sans.length ? a.sans : null, key });
  fs.mkdirSync(a.out, { recursive: true });
  const suffix = a.sans.length ? "-sensibilite" : "";
  fs.writeFileSync(path.join(a.out, `resultats${suffix}.md`), md);
  fs.writeFileSync(path.join(a.out, `detail-par-texte${suffix}.csv`), detailCsv(perText));
  return { problems: [], perText, cond, decision, md, cleSha256: crypto.createHash("sha256").update(keyRaw).digest("hex") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const r = run(a);
    if (r.problems.length) { console.error(`✗ ${r.problems.length} point(s) à corriger avant de calculer (aucun résultat produit) :`); r.problems.slice(0, 25).forEach((p) => console.error("  - " + p)); process.exit(2); }
    console.log(`✓ Résultats écrits dans ${a.out} (empreinte de la clé lue : ${r.cleSha256}).`);
    for (const c of [...CHIFFREES, ...NEUTRES]) console.log(`  ${c.padEnd(2)} : ${f2(r.cond[c].moyenne)} élément(s) non supporté(s) par post (total ${r.cond[c].total})`);
    console.log(`  C − B = ${f2(r.decision.dCB)} ; D − B = ${f2(r.decision.dDB)}`);
    for (const l of r.decision.lines) console.log(`  → ligne ${l.ligne} : ${l.phrase}`);
    for (const n of r.decision.notes) console.log(`  ⚠ ${n}`);
  } catch (e) { console.error("Erreur :", e.message); process.exit(1); }
}
