#!/usr/bin/env node
// Test E4 : construit la page de lecture et de saisie du classement à partir du lot anonymisé (identifiants, sujets, fiches, textes).
// Aucune condition : ce script ne lit que les textes bruts mélangés et les retraits décidés (voir anonymisation/README-anonymisation.md).
// Sortie : docs/e4-chiffres/classement/lecteur-classement.html (page à publier telle quelle).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyRemovals } from "./e4-anonymize.mjs";
import { readFiches } from "./e4-generate-c.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const D = path.join(ROOT, "docs/e4-chiffres");

export function buildData({ anonDir = path.join(D, "anonymisation"), fiches = readFiches() } = {}) {
  const items = JSON.parse(fs.readFileSync(path.join(anonDir, "textes-bruts-melanges.json"), "utf8"));
  const retraits = JSON.parse(fs.readFileSync(path.join(anonDir, "retraits.json"), "utf8"));
  const subjects = Object.keys(fiches).sort().map((id) => ({ id, subject: fiches[id].subject, facts: fiches[id].facts.split("\n") }));
  const texts = [];
  for (const s of subjects) for (const it of items.filter((x) => x.subject === s.id)) texts.push({ id: it.id, subject: s.id, text: applyRemovals(it.text, retraits[it.id] ?? []).text });
  if (texts.length !== 70) throw new Error(`70 textes attendus, ${texts.length} lus.`);
  return { subjects, texts };
}
export function buildHtml(data, template = fs.readFileSync(path.join(HERE, "e4-lecteur.template.html"), "utf8")) {
  const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
  const json = JSON.stringify(data).replace(/</g, "\\u003c").split(LS).join("\\u2028").split(PS).join("\\u2029");
  if (!template.includes("/*__DATA__*/")) throw new Error("Gabarit sans emplacement de données.");
  return template.replace("/*__DATA__*/", () => json);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const out = path.join(D, "classement/lecteur-classement.html");
    const html = buildHtml(buildData());
    fs.writeFileSync(out, html);
    console.log(`✓ ${out} (${(html.length / 1024).toFixed(0)} Ko, 70 textes)`);
  } catch (e) { console.error("Erreur :", e.message); process.exit(1); }
}
