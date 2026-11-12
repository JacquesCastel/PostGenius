#!/usr/bin/env node
// Test E4 : anonymisation des 70 textes (A, B, AN, BN, C, CN, D) avant classement. Voir protocole, sections 2 et 6.
//
// Trois commandes, dans cet ordre :
//   build       lit les enregistrements bruts, attribue un identifiant aléatoire à chaque texte, mélange, écrit
//               - anonymisation/textes-bruts-melanges.json   (identifiant, sujet, texte brut : AUCUNE condition)
//               - anonymisation/NE-PAS-OUVRIR-avant-classement/cle-anonymisation.json   (identifiant → condition, fichier, empreinte)
//   candidates  affiche, sous leur identifiant seulement, le premier et le dernier paragraphe de chaque texte
//               et les mentions d'outils ou de modèles (aucune condition affichée) : c'est tout ce que l'on lit pour décider des retraits
//   apply       applique anonymisation/retraits.json (décisions écrites à la main : identifiant → paragraphes retirés, exacts),
//               refuse tout retrait qui n'est pas le tout début ou la toute fin du texte, et écrit
//               - anonymisation/lot-classement.md   (textes nettoyés, groupés par sujet, ordre mélangé dans chaque sujet, fiche en regard)
//               - anonymisation/retraits.md         (ce qui a été retiré, texte par texte)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { sha256 } from "./e4-generate.mjs";
import { readFiches } from "./e4-generate-c.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const E4 = path.join(ROOT, "docs/e4-chiffres");
export const SOURCES = [
  { dir: "enregistrements-AB", conditions: ["A", "B", "AN", "BN"] },
  { dir: "enregistrements-C", conditions: ["C", "CN"] },
  { dir: "enregistrements-D", conditions: ["D"] },
];
export const TOOL_WORDS = /\b(linkeepost|postgenius|chatgpt|gpt[-\s]?\d|openai|anthropic|claude|sonnet|llm|intelligence artificielle|\bia\b)\b/i;

export function loadRecords(base = E4) {
  const items = [];
  for (const s of SOURCES) {
    for (const f of fs.readdirSync(path.join(base, s.dir)).filter((x) => x.endsWith(".json")).sort()) {
      const r = JSON.parse(fs.readFileSync(path.join(base, s.dir, f), "utf8"));
      const m = r.id.match(/^(AN|BN|A|B|CN|C|D)-S(\d\d)$/);
      if (!m || !s.conditions.includes(m[1])) continue; // B-Sxx de enregistrements-AB, D de D ; ignore le reste
      if (r.failed || !r.text) throw new Error(`Enregistrement ${r.id} sans texte (${s.dir}/${f}).`);
      items.push({ recordId: r.id, condition: m[1], subject: `S${m[2]}`, file: `${s.dir}/${f}`, recordSha256: r.sha256, raw: String(r.text).replace(/\r\n/g, "\n") });
    }
  }
  return items;
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sans 0, 1, I, L, O
export function newId(rand = crypto.randomInt) { return "T-" + Array.from({ length: 4 }, () => ALPHABET[rand(ALPHABET.length)]).join(""); }
export function shuffle(arr, rand = crypto.randomInt) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Attribue un identifiant unique à chaque texte et mélange l'ordre
export function assign(items, rand = crypto.randomInt) {
  const used = new Set();
  return shuffle(items, rand).map((it) => { let id; do id = newId(rand); while (used.has(id)); used.add(id); return { ...it, id }; });
}

export const paragraphs = (t) => t.replace(/^\s+|\s+$/g, "").split(/\n\s*\n/);

// Retire des paragraphes exacts, seulement s'ils sont en tête ou en queue de texte. Renvoie { text, removed:[{position, text}] }.
export function applyRemovals(raw, removals = []) {
  let ps = paragraphs(raw);
  const removed = [];
  for (const r of removals) {
    const want = r.text.trim();
    if (r.position === "debut") {
      if (ps[0].trim() !== want) throw new Error(`Retrait « début » : le premier paragraphe n'est pas « ${want.slice(0, 60)}… ».`);
      removed.push({ position: "début", text: ps.shift() });
    } else if (r.position === "fin") {
      if (ps[ps.length - 1].trim() !== want) throw new Error(`Retrait « fin » : le dernier paragraphe n'est pas « ${want.slice(0, 60)}… ».`);
      removed.push({ position: "fin", text: ps.pop() });
    } else throw new Error(`Position inconnue : ${r.position}`);
    if (!ps.length) throw new Error("Retrait de tout le texte refusé.");
  }
  return { text: ps.join("\n\n"), removed };
}

const D = path.join(E4, "anonymisation");
const KEYDIR = path.join(D, "NE-PAS-OUVRIR-avant-classement");
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

function build() {
  if (fs.existsSync(path.join(KEYDIR, "cle-anonymisation.json"))) throw new Error("La clé existe déjà : on ne réattribue jamais les identifiants (supprimer à la main, et le consigner au journal, si nécessaire).");
  const items = assign(loadRecords());
  if (items.length !== 70) throw new Error(`70 textes attendus, ${items.length} lus.`);
  write(path.join(D, "textes-bruts-melanges.json"), JSON.stringify(items.map(({ id, subject, raw }) => ({ id, subject, text: raw })), null, 2) + "\n");
  const key = JSON.stringify(items.map(({ id, condition, subject, recordId, file, recordSha256 }) => ({ id, condition, subject, recordId, file, recordSha256 })), null, 2) + "\n";
  write(path.join(KEYDIR, "cle-anonymisation.json"), key);
  console.log(`✓ ${items.length} textes codés. Empreinte SHA-256 de la clé (à publier avant le classement) : ${sha256(key)}`);
}

function candidates() {
  const items = read(path.join(D, "textes-bruts-melanges.json"));
  for (const it of items) {
    const ps = paragraphs(it.text);
    console.log(`\n=== ${it.id} (${it.subject}, ${ps.length} paragraphes, ${it.text.length} caractères)`);
    console.log(`[DÉBUT] ${ps[0]}`);
    if (ps.length > 1) console.log(`[FIN] ${ps[ps.length - 1]}`);
    const hits = it.text.match(new RegExp(TOOL_WORDS.source, "gi"));
    if (hits) console.log(`[OUTIL] mentions : ${[...new Set(hits.map((h) => h.toLowerCase()))].join(", ")}`);
  }
}

function apply() {
  const items = read(path.join(D, "textes-bruts-melanges.json"));
  const decisions = read(path.join(D, "retraits.json")); // { "T-XXXX": [{ position:"debut"|"fin", text:"…" }], … }
  for (const id of Object.keys(decisions)) if (!items.some((i) => i.id === id)) throw new Error(`Identifiant inconnu dans retraits.json : ${id}`);
  const fiches = readFiches();
  const clean = items.map((it) => { const r = applyRemovals(it.text, decisions[it.id] ?? []); return { ...it, clean: r.text, removed: r.removed }; });
  const bySubject = {};
  for (const c of clean) (bySubject[c.subject] ??= []).push(c);
  let md = "# E4 : lot de classement (textes anonymisés)\n\nChaque texte porte un identifiant aléatoire. Le sujet et la fiche de faits sont donnés en regard ; la condition n'est pas indiquée. Les phrases qui ne font pas partie du post ont été retirées selon `retraits.md`.\n";
  for (const s of Object.keys(bySubject).sort()) {
    md += `\n---\n\n## ${s}\n\n**Sujet** : ${fiches[s].subject}\n\n**Fiche de faits (référence de classement)** :\n\n${fiches[s].facts.split("\n").map((l) => `- ${l}`).join("\n")}\n`;
    for (const c of bySubject[s]) md += `\n### ${c.id}\n\n${c.clean}\n`;
  }
  write(path.join(D, "lot-classement.md"), md);
  let log = "# E4 : retraits à l'anonymisation (texte par texte)\n\nRègle : seuls des paragraphes entiers, au tout début ou à la toute fin d'un texte, qui ne font pas partie du post. Les enregistrements bruts restent intacts.\n";
  const withR = clean.filter((c) => c.removed.length);
  log += `\n${withR.length} texte(s) sur ${clean.length} avec retrait.\n`;
  for (const c of withR) for (const r of c.removed) log += `\n- **${c.id}**, ${r.position} :\n  > ${r.text.replace(/\n/g, "\n  > ")}\n`;
  write(path.join(D, "retraits.md"), log);
  console.log(`✓ lot-classement.md (${clean.length} textes), retraits.md (${withR.length} texte(s) avec retrait).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  const commands = { build, candidates, apply };
  try {
    if (!commands[cmd]) throw new Error("Commande : build, candidates ou apply.");
    commands[cmd]();
  } catch (e) { console.error("Erreur :", e.message); process.exit(1); }
}
