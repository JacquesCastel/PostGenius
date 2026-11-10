#!/usr/bin/env node
// Test E4 : annexe publiable du compte rendu (clé ouverte). Pour chaque condition : outil, modèle, date, consigne exacte (sujet 1 en exemple),
// puis les 10 textes complets, tels que générés, avec les éléments non fidèles relevés par le classeur.
// Sortie : docs/e4-chiffres/compte-rendu/annexe-textes.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./e4-compare.mjs";
import { readPrompts } from "./e4-generate.mjs";
import { readFiches } from "./e4-generate-c.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = path.resolve(HERE, "../docs/e4-chiffres");
const read = (f) => fs.readFileSync(path.join(D, f), "utf8");
export const ORDER = ["A", "B", "C", "D", "AN", "BN", "CN"];

export function loadAll() {
  const key = JSON.parse(read("anonymisation/NE-PAS-OUVRIR-avant-classement/cle-anonymisation.json"));
  const rec = {};
  for (const dir of ["enregistrements-AB", "enregistrements-C", "enregistrements-D"]) for (const f of fs.readdirSync(path.join(D, dir)).filter((x) => x.endsWith(".json"))) { const j = JSON.parse(read(`${dir}/${f}`)); rec[`${dir}/${j.id}`] = j; }
  const grid = parseCsv(read("classement/grille-elements-claude.csv")).slice(1).map((r) => ({ id: r[0], element: r[2], type: r[3], code: r[4], ligne: r[5], recherche: r[6], source: r[7], comment: r[8] }));
  return { key, rec, grid };
}
const recOf = (rec, k) => rec[`${k.file.split("/")[0]}/${k.recordId}`];
const quote = (t) => t.trim().split("\n").map((l) => (l.trim() ? `> ${l}` : ">")).join("\n");

export function buildAnnexe() {
  const { key, rec, grid } = loadAll();
  const prompts = readPrompts(), fiches = readFiches();
  const when = (c) => { const ds = key.filter((k) => k.condition === c).map((k) => recOf(rec, k).generatedAt).sort(); const f = (s) => s.replace("T", " ").slice(0, 16) + " UTC"; return ds[0].slice(0, 10) === ds.at(-1).slice(0, 10) ? `${ds[0].slice(0, 10)}, de ${f(ds[0]).slice(11)} à ${f(ds.at(-1)).slice(11)}` : `${f(ds[0])} à ${f(ds.at(-1))}`; };
  const meta = {
    A: { outil: "Modèle OpenAI par l'API, sans les faits", modele: "`gpt-5.5-2026-04-23`", consigne: prompts["A-S01"] },
    B: { outil: "Même modèle, avec la fiche de faits", modele: "`gpt-5.5-2026-04-23`", consigne: prompts["B-S01"] },
    C: { outil: "LinkeePost (moteur de génération, appel direct de la route de génération, compte au profil neutre)", modele: "`claude-sonnet-4-6` (modèle par défaut du moteur ; le moteur ne renvoie pas le nom du modèle servi)", consigne: `Thème transmis au moteur : « ${prompts["A-S01"]} »\nFiche transmise comme matière source (titre « Fiche de faits ») :\n${fiches.S01.facts}` },
    D: { outil: "Modèle d'Anthropic par l'API, sans l'invite de LinkeePost, avec la fiche de faits", modele: "`claude-sonnet-4-6`", consigne: prompts["B-S01"] },
    AN: { outil: "Modèle OpenAI par l'API, sans les faits, consigne neutre (sans demande de chiffres)", modele: "`gpt-5.5-2026-04-23`", consigne: prompts["AN-S01"] },
    BN: { outil: "Même modèle, avec la fiche de faits, consigne neutre", modele: "`gpt-5.5-2026-04-23`", consigne: prompts["BN-S01"] },
    CN: { outil: "LinkeePost, consigne neutre, fiche en source", modele: "`claude-sonnet-4-6` (modèle par défaut du moteur)", consigne: `Thème transmis au moteur : « ${prompts["AN-S01"]} »\nFiche transmise comme matière source (titre « Fiche de faits ») :\n${fiches.S01.facts}` },
  };
  const names = { A: "A", B: "B", C: "C", D: "D", AN: "A neutre", BN: "B neutre", CN: "C neutre" };
  const L = ["# Annexe : les 70 textes, tels que générés", "",
    "Chaque texte est donné en entier, avec son identifiant d'anonymisation (celui du lot de classement). Les éléments relevés comme non fidèles par le classeur (codes I, D, X) ou vérifiés (V) sont listés sous le texte ; les éléments fidèles à la fiche (F) ne sont pas relistés (voir `classement/grille-elements-claude.csv`). Les enregistrements bruts (requête, réponse, empreinte de chaque génération) sont dans `enregistrements-AB/`, `enregistrements-C/` et `enregistrements-D/`.", "",
    "Les entreprises, personnes et chiffres des fiches sont fictifs. Une ligne « # Post LinkedIn… » ou « # Brouillon LinkedIn… » placée par le modèle devant son texte figure ici dans le texte d'origine ; elle avait été retirée dans le lot de classement (7 textes, voir `anonymisation/retraits.md`).", "", "## Les 10 fiches de faits", ""];
  for (const s of Object.keys(fiches).sort()) L.push(`**${s}. ${fiches[s].subject}**`, "", ...fiches[s].facts.split("\n").map((x) => `- ${x}`), "");
  for (const c of ORDER) {
    L.push(`## Condition ${names[c]}`, "", `- **Outil** : ${meta[c].outil}`, `- **Modèle** : ${meta[c].modele}`, `- **Date de génération** : ${when(c)}`, `- **Consigne exacte (sujet 1 en exemple ; les neuf autres changent le sujet et, selon la condition, la fiche ; les 40 consignes sont dans \`consignes-E4-chatgpt-40.md\`)** :`, "", "```text", meta[c].consigne, "```", "");
    for (const k of key.filter((x) => x.condition === c).sort((a, b) => a.subject.localeCompare(b.subject))) {
      const r = recOf(rec, k), g = grid.filter((e) => e.id === k.id);
      L.push(`### ${names[c]}, sujet ${k.subject.slice(1).replace(/^0/, "")} (${k.id})`, "", quote(r.text), "");
      const bad = g.filter((e) => ["I", "D", "X", "V"].includes(e.code));
      if (!bad.length) L.push("*Aucun élément non fidèle relevé.*", "");
      else { L.push("Éléments relevés :", ""); for (const e of bad) L.push(`- **${e.code}** : « ${e.element.replace(/\s+/g, " ")} »${e.comment ? ` (${e.comment})` : ""}${e.source ? ` ; source : ${e.source}` : ""}`); L.push(""); }
    }
  }
  return L.join("\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const md = buildAnnexe(); const out = path.join(D, "compte-rendu/annexe-textes.md"); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, md); console.log(`✓ ${out} (${(md.length / 1024).toFixed(0)} Ko)`); } catch (e) { console.error("Erreur :", e.message); process.exit(1); }
}
