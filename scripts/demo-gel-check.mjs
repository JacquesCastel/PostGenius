#!/usr/bin/env node
// Démonstration éditoriale : vérifie que les fichiers du dépôt ont exactement les empreintes SHA-256 publiées dans gel-demo-empreintes.md.
// À lancer au début de la session de génération : en cas d'écart, ne rien générer.
//   node scripts/demo-gel-check.mjs [--ecrire]
// --ecrire : (re)génère le tableau d'empreintes dans la page de gel à partir des fichiers actuels (AVANT publication du gel seulement).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const GEL = path.join(ROOT, "docs/demo-editoriale/gel-demo-empreintes.md");
export const sha256File = (rel) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");

// Fichiers du gist : nom dans le gist → chemin dans le dépôt
export const GIST_FILES = [
  ["demoEditorialCore.mjs", "lib/demoEditorialCore.mjs"],
  ["demo-editorial.mjs", "scripts/demo-editorial.mjs"],
  ["protocole-test.md", "docs/demo-editoriale/protocole-test.md"],
  ["session-generation-checklist.md", "docs/demo-editoriale/session-generation-checklist.md"],
];
// Moteur : la route de génération et les modules qu'elle importe directement (lus dans le code, jamais recopiés à la main)
export function engineFiles() {
  const route = "app/api/generate/route.js";
  const src = fs.readFileSync(path.join(ROOT, route), "utf8");
  const mods = [...new Set([...src.matchAll(/from "@\/(lib\/[A-Za-z0-9_/]+)"/g)].map((m) => m[1]))].sort();
  const files = [route];
  for (const m of mods) { const f = ["js", "mjs"].map((e) => `${m}.${e}`).find((x) => fs.existsSync(path.join(ROOT, x))); if (!f) throw new Error(`Module introuvable : ${m}`); files.push(f); }
  return files;
}

// Lit les paires (chemin, empreinte) du tableau de la page de gel : toute ligne de tableau avec un chemin entre accents graves et 64 caractères hexadécimaux
export function readPublished(md) {
  const out = [];
  for (const line of md.split("\n")) {
    if (!line.startsWith("|")) continue;
    const p = line.match(/`((?:lib|app|scripts|docs)\/[^`\s]+)`/), h = line.match(/`([0-9a-f]{64})`/);
    if (p && h) out.push({ path: p[1], sha256: h[1] });
  }
  return out;
}
export function check(md = fs.readFileSync(GEL, "utf8")) {
  const published = readPublished(md);
  const expected = [...GIST_FILES.map((g) => g[1]), ...engineFiles()];
  const problems = [];
  for (const rel of expected) if (!published.some((p) => p.path === rel)) problems.push(`non publié dans le gel : ${rel}`);
  for (const p of published) {
    if (!fs.existsSync(path.join(ROOT, p.path))) { problems.push(`fichier absent : ${p.path}`); continue; }
    const now = sha256File(p.path);
    if (now !== p.sha256) problems.push(`ÉCART : ${p.path} (publié ${p.sha256.slice(0, 12)}…, actuel ${now.slice(0, 12)}…)`);
  }
  return { ok: problems.length === 0, checked: published.length, problems };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = check();
    if (r.ok) console.log(`Gel respecté : ${r.checked} fichiers conformes aux empreintes publiées.`);
    else { console.log(`GEL NON RESPECTÉ (${r.problems.length} écart(s)) : ne rien générer.`); r.problems.forEach((p) => console.log("  - " + p)); process.exit(2); }
  } catch (e) { console.error("Erreur :", e.message); process.exit(1); }
}
