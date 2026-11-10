#!/usr/bin/env node
// Démonstration de l'intelligence éditoriale : produire, conserver, vérifier et publier des exemples AUTHENTIQUES.
//
// Principe : on ne rédige jamais un exemple à la main. Le script crée des comptes de démonstration isolés (un par entreprise, plus un
// témoin sans profil), puis appelle le VRAI moteur (POST /api/generate, non modifié) avec le même sujet pour chacun, et conserve
// l'enregistrement complet de chaque génération (requête, profil lu en base, contexte rapporté par le moteur, réponse brute) avec une empreinte.
// Seuls les exemples dont l'empreinte se recalcule sont publiables. Rien n'est jamais publié sur LinkedIn.
//
// Commandes (voir docs/demo-editoriale/README.md) :
//   seed      crée ou met à jour les comptes de démonstration           (exige DEMO_EDITORIALE_DB_OK=1)
//   generate  génère N candidats par identité avec le vrai moteur         (--base http://localhost:3000 --runs 1 [--only aster])
//   list      liste les candidats conservés
//   publish   publie les candidats choisis dans content/demo-editoriale.json
//             --aster <id> --axiome <id> --expert <id> [--temoin <id>] [--comparison fichier.json]
//   verify    recalcule les empreintes de content/demo-editoriale.json
//
// Variables : DATABASE_URL (base des comptes de démonstration : de préférence une COPIE, par exemple une branche Neon, jamais la production),
//             DEMO_EDITORIALE_DIR (candidats, défaut data/demo-editoriale), DEMO_EDITORIALE_OUT (défaut content/demo-editoriale.json),
//             ANTHROPIC_MODEL (indication enregistrée avec chaque exemple ; le moteur lit sa propre variable côté serveur).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { IDENTITIES, SUBJECT, PROFILE_FIELDS, COMPANY_IDS, identityOf, recordHash, validateEntry, cleanComparison } from "../lib/demoEditorialCore.mjs";

const DIR = process.env.DEMO_EDITORIALE_DIR || path.join(process.cwd(), "data", "demo-editoriale");
const OUT = process.env.DEMO_EDITORIALE_OUT || path.join(process.cwd(), "content", "demo-editoriale.json");
const CAND = path.join(DIR, "candidates.json");
const ACC = path.join(DIR, "accounts.json");
const emailOf = (id) => `demo-editoriale-${id}@demo.invalid`;

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, def = null) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def; };
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const readJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return def; } };
const writeJson = (f, v, mode) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n", mode ? { mode } : undefined); };

async function prismaClient() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

// ── seed ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function seed() {
  if (process.env.DEMO_EDITORIALE_DB_OK !== "1") fail("Refusé : définissez DEMO_EDITORIALE_DB_OK=1 pour confirmer que DATABASE_URL est une base de démonstration (une copie, jamais la production).");
  const bcrypt = (await import("bcryptjs")).default;
  const prisma = await prismaClient();
  let host = "inconnue";
  try { host = new URL(process.env.DATABASE_URL).host; } catch {}
  console.log(`Base : ${host}`);
  const accounts = readJson(ACC, {});
  for (const id of IDENTITIES.map((i) => i.id)) {
    const identity = identityOf(id);
    const email = emailOf(id);
    const password = accounts[id]?.password ?? crypto.randomBytes(18).toString("base64url");
    const data = { name: identity.name, plan: "pro", trialEndsAt: new Date(Date.now() + 90 * 86400000), planUpdatedAt: new Date(), onboardedAt: new Date(), expertise: identity.expertise, ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f, identity.profile[f] ?? null])) };
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) await prisma.user.update({ where: { email }, data: { ...data, password: await bcrypt.hash(password, 10), disabled: false } });
    else await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 10), ...data } });
    accounts[id] = { email, password };
    console.log(`  ${existing ? "mis à jour" : "créé"} : ${email}`);
  }
  writeJson(ACC, accounts, 0o600); // mots de passe locaux, jamais versionnés (le dossier data/ est ignoré par Git)
  await prisma.$disconnect();
  console.log("✓ Comptes de démonstration prêts. Ils sont isolés : profil, sources, remarques et mémoire sont propres à chaque compte.");
}

// ── generate ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function login(base, email, password) {
  const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  if (!r.ok || !cookie) fail(`Connexion impossible pour ${email} (code ${r.status}). Avez-vous lancé « seed » sur la même base que celle du serveur ?`);
  return cookie;
}

async function generate() {
  const base = (flag("base", "http://localhost:3000")).replace(/\/$/, "");
  const runs = Math.min(10, Math.max(1, Number(flag("runs", "1")) || 1)); // une génération par identité par défaut : aucun choix humain entre plusieurs essais
  const only = flag("only");
  const accounts = readJson(ACC, null);
  if (!accounts) fail("Aucun compte de démonstration : lancez d'abord « seed ».");
  try { await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) }); } catch { fail(`Serveur injoignable à ${base}. Lancez l'application (npm run build puis npm start, avec DATABASE_URL et ANTHROPIC_API_KEY) et indiquez son adresse avec --base.`); }
  const prisma = await prismaClient();
  const candidates = readJson(CAND, []);
  for (const identity of IDENTITIES) {
    if (only && identity.id !== only) continue;
    const acc = accounts[identity.id];
    if (!acc) fail(`Compte manquant pour ${identity.id} : relancez « seed ».`);
    const cookie = await login(base, acc.email, acc.password);
    // Profil tel que le moteur le lit en base, au moment de la génération
    const user = await prisma.user.findUnique({ where: { email: acc.email }, select: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, true])) });
    if (!user) fail(`Compte introuvable en base pour ${identity.id}.`);
    const profile = Object.fromEntries(PROFILE_FIELDS.map((f) => [f, user[f] ?? null]));
    // Contexte que le moteur rapporte lui-même (lecture seule, sans IA)
    const ctxRes = await fetch(`${base}/api/generate/context`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ theme: SUBJECT.text }) });
    const contextReport = ctxRes.ok ? await ctxRes.json() : null;
    for (let n = 1; n <= runs; n++) {
      const request = { type: "simple", theme: SUBJECT.text, expertise: identity.expertise, tone: identity.tone, maxChars: 1300, language: "fr" };
      const res = await fetch(`${base}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(request) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.text !== "string" || !body.text.trim()) {
        writeJson(CAND, candidates);
        fail(`Génération impossible pour ${identity.id} (code ${res.status}) : ${body.error ?? "réponse vide"}. Aucun texte n'a été inventé. Vérifiez ANTHROPIC_API_KEY et l'accès réseau du serveur.`);
      }
      const record = { request, profile, contextReport, response: { text: body.text, why: body.why ?? null, sources: body.sources ?? [] } };
      const cand = { id: `${identity.id}-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${n}`, identity: identity.id, generatedAt: new Date().toISOString(), record, recordHash: recordHash(record), engine: { route: "POST /api/generate", modelHint: process.env.ANTHROPIC_MODEL || "modèle par défaut du serveur (voir app/api/generate/route.js)", server: base } };
      candidates.push(cand);
      writeJson(CAND, candidates);
      console.log(`  ✓ ${cand.id}  « ${cand.record.response.text.split("\n")[0].slice(0, 90)} »`);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  await prisma.$disconnect();
  console.log(`✓ Candidats conservés dans ${CAND}. Lisez-les (« list »), choisissez, puis « publish ». Tous les candidats restent conservés : la page annonce « sélectionné parmi N générations ».`);
}

// ── list ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function list() {
  const cands = readJson(CAND, []);
  if (!cands.length) return console.log("Aucun candidat. Lancez « generate ».");
  for (const c of cands) {
    console.log(`\n[${c.id}]  ${c.identity}  ${c.generatedAt}  empreinte ${c.recordHash.slice(0, 12)}`);
    console.log(c.record.response.text.split("\n").map((l) => `   ${l}`).join("\n"));
  }
}

// ── publish ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function publish() {
  const cands = readJson(CAND, []);
  const entries = {};
  for (const id of [...COMPANY_IDS, "temoin"]) {
    const chosen = flag(id);
    if (!chosen) { if (id !== "temoin") fail(`Indiquez le candidat retenu pour ${id} : --${id} <identifiant> (voir « list »).`); continue; }
    const cand = cands.find((c) => c.id === chosen && c.identity === id);
    if (!cand) fail(`Candidat introuvable pour ${id} : ${chosen}`);
    const check = validateEntry(cand, id);
    if (!check.ok) fail(`Candidat refusé pour ${id} : ${check.reasons.join(" ; ")}`);
    entries[id] = { ...cand, selectedFrom: cands.filter((c) => c.identity === id).length, selectedAt: new Date().toISOString() };
  }
  let comparison = null;
  const cf = flag("comparison");
  if (cf) {
    comparison = cleanComparison(readJson(cf, null));
    if (!comparison) fail("Comparaison invalide : attendu { authoredBy, note?, rows: [{ label, aster?, axiome?, expert? }] }.");
  }
  writeJson(OUT, { version: 1, publishedAt: new Date().toISOString(), entries, ...(comparison ? { comparison } : {}) });
  console.log(`✓ Publié dans ${OUT} : ${Object.keys(entries).join(", ")}${comparison ? " + lecture comparative" : ""}.`);
  console.log("  Les textes sont repris tels que générés (aucune modification). Relancez « verify », puis construisez et déployez comme d'habitude.");
}

// ── verify ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function verify() {
  const data = readJson(OUT, null);
  if (!data) fail(`Fichier illisible : ${OUT}`);
  const ids = Object.keys(data.entries ?? {});
  if (!ids.length) { console.log("Aucun exemple publié (état « en préparation »)."); return; }
  let bad = 0;
  for (const id of ids) {
    const r = validateEntry(data.entries[id], id);
    console.log(`${r.ok ? "✓" : "✗"} ${id}${r.ok ? "" : " : " + r.reasons.join(" ; ")}`);
    if (!r.ok) bad++;
  }
  if (bad) fail(`${bad} exemple(s) invalide(s) : la page refusera de les afficher.`);
  console.log("✓ Toutes les empreintes se recalculent : les textes sont ceux que le moteur a produits.");
}

const COMMANDS = { seed, generate, list, publish, verify };
if (!COMMANDS[cmd]) { console.log("Usage : node scripts/demo-editorial.mjs <seed|generate|list|publish|verify>   (voir docs/demo-editoriale/README.md)"); process.exit(cmd ? 1 : 0); }
await COMMANDS[cmd]();
