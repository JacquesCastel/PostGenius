#!/usr/bin/env node
// Test E4, condition C : génération avec le VRAI moteur LinkeePost (POST /api/generate, non modifié), profil neutre identique pour les 10 sujets,
// la fiche de faits fournie comme « matière source ». 20 textes : C-S01…C-S10 (consigne chiffrée) et CN-S01…CN-S10 (consigne neutre).
// Voir docs/e4-chiffres/protocole-E4-chiffres-inventes.md (sections 2 et 4) et docs/e4-chiffres/README-C.md.
//
// Règles appliquées (mêmes que scripts/e4-generate.mjs) :
//  - la consigne de base est lue mot pour mot dans le fichier gelé docs/e4-chiffres/consignes-E4-chatgpt-40.md (A-Sxx pour C, AN-Sxx pour CN) ;
//    elle est transmise telle quelle comme thème ; son empreinte est vérifiée ;
//  - la fiche est lue dans docs/e4-chiffres/fiches-E4-fictives.md (empreinte vérifiée) et transmise comme source (lignes F1, F2…, sans rien ajouter) ;
//  - UNE génération par texte : une réponse reçue est conservée et jamais régénérée ; seuls les échecs sans réponse (réseau, 429, 5xx) sont relancés et consignés ;
//  - requête, profil lu en base, réponse brute et empreinte SHA-256 sont enregistrés pour chaque texte.
//
// Usage (voir README-C.md) :
//   node scripts/e4-generate-c.mjs --dry-run                                  (affiche les 20 requêtes, ne contacte rien)
//   E4_C_DB_OK=1 node --env-file=.env scripts/e4-generate-c.mjs seed          (crée le compte neutre dans la base de DÉMONSTRATION)
//   node --env-file=.env scripts/e4-generate-c.mjs generate --base http://localhost:3000 --out data/e4/run1-C
//   options : --only C-S01,CN-S02   --max-chars 1700   --accounts <fichier>   --no-verify (tests seulement)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readPrompts, sha256 } from "./e4-generate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const FICHES_FILE = path.join(ROOT, "docs/e4-chiffres/fiches-E4-fictives.md");
export const FICHES_SHA256 = "ffc46b16057044d43764e5eb71710ad920114de3846347081b2e533f67086425";
export const NEUTRAL_EMAIL = "e4-condition-c@demo.invalid";
// Profil neutre (fiches, « Profil neutre pour la condition C ») : identique pour les 10 sujets, aucune consigne chiffrée, aucune autre source.
export const NEUTRAL_PROFILE = { headline: "Professionnel B2B", styleNotes: "Ton sobre et direct. Phrases courtes." };
export const NEUTRAL_EXPERTISE = "Professionnel B2B";
export const NEUTRAL_TONE = "Professionnel";
export const PROFILE_FIELDS = ["headline", "companyName", "businessDescription", "targetAudience", "market", "commGoals", "editorialLine", "styleNotes"];
const MIN_SOURCE_CHARS = 200; // lib/generationSource.js : en dessous, le moteur ignorerait silencieusement la source

// { "S01": { subject, facts: "F1. …\nF2. …" }, … } lu dans le fichier gelé des fiches
export function readFiches(file = FICHES_FILE, { verify = true } = {}) {
  const raw = fs.readFileSync(file, "utf8");
  if (verify && sha256(raw) !== FICHES_SHA256) throw new Error(`Le fichier des fiches ne correspond pas à l'empreinte gelée (${sha256(raw)}).`);
  const out = {};
  for (const m of raw.matchAll(/^## S(\d+)\. [^\n]*\n\*\*Sujet\*\* : ([^\n]+)\n((?:- F\d+\.[^\n]*\n?)+)/gm)) {
    const id = `S${String(m[1]).padStart(2, "0")}`;
    out[id] = { subject: m[2].trim(), facts: m[3].trim().split("\n").map((l) => l.replace(/^- /, "")).join("\n") };
  }
  if (Object.keys(out).length !== 10) throw new Error(`10 fiches attendues, ${Object.keys(out).length} lues.`);
  for (const [id, f] of Object.entries(out)) if (f.facts.length < MIN_SOURCE_CHARS) throw new Error(`Fiche ${id} trop courte (${f.facts.length} < ${MIN_SOURCE_CHARS}) : le moteur l'ignorerait.`);
  return out;
}

// 20 requêtes : C-Sxx (consigne chiffrée = A-Sxx du fichier gelé) et CN-Sxx (consigne neutre = AN-Sxx), fiche en source
export function buildJobs({ prompts, fiches, maxChars = 1700 }) {
  const jobs = [];
  for (const n of Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"))) {
    for (const [pre, basePre] of [["C", "A"], ["CN", "AN"]]) {
      const theme = prompts[`${basePre}-S${n}`];
      if (!theme) throw new Error(`Consigne ${basePre}-S${n} introuvable.`);
      if (!theme.includes(fiches[`S${n}`].subject.replace(/\.$/, ""))) throw new Error(`La consigne ${basePre}-S${n} ne reprend pas le sujet de la fiche S${n}.`);
      jobs.push({
        id: `${pre}-S${n}`,
        request: {
          type: "simple", theme, expertise: NEUTRAL_EXPERTISE, tone: NEUTRAL_TONE, maxChars, language: "fr",
          source: { title: "Fiche de faits", origin: "fiche fournie par l'auteur", text: fiches[`S${n}`].facts },
        },
      });
    }
  }
  return jobs;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hashOf = (rec) => sha256(JSON.stringify({ ...rec, sha256: undefined }));

// Une génération : relance UNIQUEMENT si aucune réponse n'a été reçue (réseau, 429, 5xx). Toute autre réponse est conservée telle quelle.
export async function generateOne({ base, cookie, id, request, maxAttempts = 3, retryDelayMs = 2000 }) {
  const attempts = [];
  for (let n = 1; n <= maxAttempts; n++) {
    const startedAt = new Date().toISOString();
    try {
      const res = await fetch(`${base}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(request) });
      const raw = await res.text();
      attempts.push({ n, startedAt, status: res.status });
      if (res.status === 429 || res.status >= 500) { await sleep(retryDelayMs * n); continue; }
      let json = null; try { json = JSON.parse(raw); } catch {}
      const rec = { id, request, status: res.status, response: json ?? raw, text: typeof json?.text === "string" ? json.text : null, why: json?.why ?? null, sources: json?.sources ?? [], attempts, generatedAt: startedAt };
      rec.sha256 = hashOf(rec);
      return rec;
    } catch (e) {
      attempts.push({ n, startedAt, error: String(e?.message ?? e) });
      await sleep(retryDelayMs * n);
    }
  }
  const rec = { id, request, status: null, response: null, text: null, attempts, failed: true, generatedAt: new Date().toISOString() };
  rec.sha256 = hashOf(rec);
  return rec;
}

function parseArgs(argv) {
  const a = { cmd: null, base: "http://localhost:3000", out: null, only: null, maxChars: 1700, accounts: path.join(ROOT, "data/e4/accounts-c.json"), dry: false, verify: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "seed" || k === "generate") a.cmd = k;
    else if (k === "--base") a.base = argv[++i].replace(/\/$/, "");
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--only") a.only = argv[++i].split(",");
    else if (k === "--max-chars") a.maxChars = Number(argv[++i]);
    else if (k === "--accounts") a.accounts = argv[++i];
    else if (k === "--dry-run") a.dry = true;
    else if (k === "--no-verify") a.verify = false;
    else throw new Error(`Option inconnue : ${k}`);
  }
  return a;
}

async function prismaClient() { const { PrismaClient } = await import("@prisma/client"); return new PrismaClient(); }

async function seed(a) {
  if (process.env.E4_C_DB_OK !== "1") throw new Error("Refusé : définissez E4_C_DB_OK=1 pour confirmer que DATABASE_URL est une base de démonstration (une copie ou une base jetable, JAMAIS la production).");
  const bcrypt = (await import("bcryptjs")).default;
  const prisma = await prismaClient();
  let host = "inconnue"; try { host = new URL(process.env.DATABASE_URL).host; } catch {}
  console.log(`Base : ${host}`);
  let acc = {}; try { acc = JSON.parse(fs.readFileSync(a.accounts, "utf8")); } catch {}
  const password = acc.password ?? crypto.randomBytes(18).toString("base64url");
  const data = { name: "Profil neutre E4", plan: "pro", trialEndsAt: new Date(Date.now() + 90 * 86400000), planUpdatedAt: new Date(), onboardedAt: new Date(), expertise: NEUTRAL_EXPERTISE, ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f, NEUTRAL_PROFILE[f] ?? null])) };
  const existing = await prisma.user.findUnique({ where: { email: NEUTRAL_EMAIL } });
  if (existing) await prisma.user.update({ where: { email: NEUTRAL_EMAIL }, data: { ...data, password: await bcrypt.hash(password, 10), disabled: false } });
  else await prisma.user.create({ data: { email: NEUTRAL_EMAIL, password: await bcrypt.hash(password, 10), ...data } });
  fs.mkdirSync(path.dirname(a.accounts), { recursive: true });
  fs.writeFileSync(a.accounts, JSON.stringify({ email: NEUTRAL_EMAIL, password }, null, 2) + "\n", { mode: 0o600 });
  await prisma.$disconnect();
  console.log(`✓ Compte neutre ${existing ? "mis à jour" : "créé"} : ${NEUTRAL_EMAIL} (mot de passe local dans ${a.accounts}, jamais versionné).`);
}

async function generate(a) {
  if (process.env.EDITORIAL_ENGINE) throw new Error(`EDITORIAL_ENGINE est défini (« ${process.env.EDITORIAL_ENGINE} ») : le protocole impose le moteur A par défaut. Retirez cette variable et relancez le serveur sans elle.`);
  if (!a.out) throw new Error("--out est obligatoire (dossier des enregistrements bruts).");
  const acc = JSON.parse(fs.readFileSync(a.accounts, "utf8"));
  const jobs = buildJobs({ prompts: readPrompts(undefined, { verify: a.verify }), fiches: readFiches(undefined, { verify: a.verify }), maxChars: a.maxChars });
  try { await fetch(`${a.base}/api/health`, { signal: AbortSignal.timeout(10000) }); } catch { throw new Error(`Serveur injoignable à ${a.base}. Lancez l'application (npm run build puis npm start) sans EDITORIAL_ENGINE.`); }
  const login = await fetch(`${a.base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: acc.email, password: acc.password }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  if (!login.ok || !cookie) throw new Error(`Connexion impossible (code ${login.status}). Avez-vous lancé « seed » sur la même base que le serveur ?`);
  const prisma = await prismaClient();
  const u = await prisma.user.findUnique({ where: { email: acc.email }, select: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, true])) });
  await prisma.$disconnect();
  if (!u) throw new Error("Compte neutre introuvable en base.");
  const profile = Object.fromEntries(PROFILE_FIELDS.map((f) => [f, u[f] ?? null]));
  for (const f of PROFILE_FIELDS) if ((profile[f] ?? null) !== (NEUTRAL_PROFILE[f] ?? null)) throw new Error(`Le profil en base n'est pas le profil neutre (${f}). Relancez « seed ».`);
  let commit = null; try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim(); } catch {}
  fs.mkdirSync(a.out, { recursive: true });
  for (const j of a.only ? jobs.filter((x) => a.only.includes(x.id)) : jobs) {
    const file = path.join(a.out, `${j.id}.json`);
    if (fs.existsSync(file)) { console.log(`${j.id} : déjà généré, conservé (aucune régénération).`); continue; }
    const rec = await generateOne({ base: a.base, cookie, id: j.id, request: j.request });
    rec.profile = profile; rec.engine = { route: "POST /api/generate", server: a.base, repoCommit: commit, editorialEngineEnv: process.env.EDITORIAL_ENGINE ?? null };
    rec.sha256 = hashOf({ ...rec, sha256: undefined });
    fs.writeFileSync(file, JSON.stringify(rec, null, 2));
    console.log(`${j.id} : ${rec.failed ? "ÉCHEC sans réponse" : `HTTP ${rec.status}, ${rec.text ? rec.text.length : 0} caractères`}`);
    if (rec.failed || rec.status !== 200 || !rec.text) console.log("  ! à consigner dans le journal (échec, réponse d'erreur ou texte vide)");
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.dry) {
    const jobs = buildJobs({ prompts: readPrompts(undefined, { verify: a.verify }), fiches: readFiches(undefined, { verify: a.verify }), maxChars: a.maxChars });
    for (const j of jobs) console.log(`--- ${j.id}\nthème : ${j.request.theme}\nsource :\n${j.request.source.text}\n`);
    console.log(`${jobs.length} requête(s) construite(s), empreintes des consignes et des fiches ${a.verify ? "vérifiées" : "NON vérifiées"}.`);
    return;
  }
  if (a.cmd === "seed") return seed(a);
  if (a.cmd === "generate") return generate(a);
  throw new Error("Commande attendue : seed, generate ou --dry-run.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
}
