#!/usr/bin/env node
// Test E4 : génération des conditions A, B (API OpenAI) et D (API Anthropic) à partir du fichier de consignes GELÉ.
// Voir docs/e4-chiffres/protocole-E4-chiffres-inventes.md. Aucune dépendance : Node 18+ (fetch intégré).
//
// Règles du protocole appliquées par ce script :
//  - la consigne est lue mot pour mot dans docs/e4-chiffres/consignes-E4-chatgpt-40.md ; l'empreinte du fichier est vérifiée ;
//  - un seul message (aucun message système), aucune mémoire, paramètres du modèle par défaut ;
//  - UNE génération par texte : si une réponse a été reçue, elle est conservée et jamais régénérée ;
//    seuls les échecs sans réponse (réseau, 429, 5xx) peuvent être relancés (comptés et consignés) ;
//  - requête et réponse brutes sont enregistrées, avec l'empreinte SHA-256 de chaque enregistrement.
//
// Usage :
//   node scripts/e4-generate.mjs --list-models                       (OpenAI : liste des modèles disponibles)
//   node scripts/e4-generate.mjs --dry-run                           (affiche les 40 consignes lues, ne contacte rien)
//   node scripts/e4-generate.mjs --provider openai --model <id> --out data/e4/run1
//   node scripts/e4-generate.mjs --provider anthropic --out data/e4/run1   (condition D : prompts de B, modèle de l'API Anthropic)
//   options : --only A-S01,B-S02  --max-tokens 4000  --base-url <url> (tests)  --no-verify (tests seulement)
// Clés : OPENAI_API_KEY / ANTHROPIC_API_KEY dans l'environnement, ou « secret réseau » injecté par le proxy (clé factice acceptée).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const CONSIGNES_FILE = path.join(ROOT, "docs/e4-chiffres/consignes-E4-chatgpt-40.md");
export const CONSIGNES_SHA256 = "d53de006cc3ca23ef428cf74cdf85247a194a31ea18cfe16d4026a50610bb0f9";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6"; // identique à app/api/generate/route.js (ANTHROPIC_MODEL ou ce défaut)

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// { "A-S01": "consigne…", … } lu mot pour mot dans le fichier gelé
export function readPrompts(file = CONSIGNES_FILE, { verify = true } = {}) {
  const raw = fs.readFileSync(file, "utf8");
  if (verify && sha256(raw) !== CONSIGNES_SHA256) throw new Error(`Le fichier de consignes ne correspond pas à l'empreinte gelée (${sha256(raw)}).`);
  const parts = raw.split(/^## ((?:A|B|AN|BN)-S\d\d) /m);
  const prompts = {};
  for (let i = 1; i < parts.length; i += 2) {
    const m = parts[i + 1].match(/```text\n([\s\S]*?)\n```/);
    if (!m) throw new Error(`Consigne introuvable pour ${parts[i]}`);
    prompts[parts[i]] = m[1];
  }
  if (Object.keys(prompts).length !== 40) throw new Error(`40 consignes attendues, ${Object.keys(prompts).length} lues.`);
  return prompts;
}

// Condition D = consigne de B (avec faits, chiffrée), appelée directement sur l'API du modèle de LinkeePost
export const dPromptFor = (prompts, id) => prompts[id.replace(/^D-/, "B-")];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOpenAI({ base, model, prompt, maxTokens, key }) {
  const body = { model, messages: [{ role: "user", content: prompt }], max_completion_tokens: maxTokens };
  const res = await fetch(`${base}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  return { status: res.status, raw: await res.text(), body };
}
async function callAnthropic({ base, model, prompt, maxTokens, key }) {
  const body = { model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
  const res = await fetch(`${base}/v1/messages`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
  return { status: res.status, raw: await res.text(), body };
}
export function extract(provider, json) {
  if (provider === "openai") return { text: json?.choices?.[0]?.message?.content ?? null, finish: json?.choices?.[0]?.finish_reason ?? null, model: json?.model ?? null, usage: json?.usage ?? null };
  return { text: (json?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("") || null, finish: json?.stop_reason ?? null, model: json?.model ?? null, usage: json?.usage ?? null };
}

// Une génération : relance UNIQUEMENT si aucune réponse exploitable n'a été reçue (réseau, 429, 5xx)
export async function generateOne({ provider, base, model, id, prompt, maxTokens, key, maxAttempts = 3 }) {
  const call = provider === "openai" ? callOpenAI : callAnthropic;
  const attempts = [];
  for (let n = 1; n <= maxAttempts; n++) {
    const startedAt = new Date().toISOString();
    try {
      const r = await call({ base, model, prompt, maxTokens, key });
      attempts.push({ n, startedAt, status: r.status });
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * n); continue; }
      let json = null; try { json = JSON.parse(r.raw); } catch {}
      const x = extract(provider, json);
      const record = { id, provider, requestedModel: model, request: r.body, status: r.status, response: json ?? r.raw, modelReturned: x.model, finish: x.finish, usage: x.usage, text: x.text, attempts, generatedAt: startedAt };
      record.sha256 = sha256(JSON.stringify({ ...record, sha256: undefined }));
      return record;
    } catch (e) {
      attempts.push({ n, startedAt, error: String(e?.message ?? e) });
      await sleep(2000 * n);
    }
  }
  const record = { id, provider, requestedModel: model, request: null, status: null, response: null, text: null, attempts, failed: true, generatedAt: new Date().toISOString() };
  record.sha256 = sha256(JSON.stringify({ ...record, sha256: undefined }));
  return record;
}

function parseArgs(argv) {
  const a = { provider: "openai", maxTokens: 4000, only: null, out: null, model: null, base: null, dry: false, list: false, verify: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--provider") a.provider = argv[++i];
    else if (k === "--model") a.model = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--only") a.only = argv[++i].split(",");
    else if (k === "--max-tokens") a.maxTokens = Number(argv[++i]);
    else if (k === "--base-url") a.base = argv[++i];
    else if (k === "--dry-run") a.dry = true;
    else if (k === "--list-models") a.list = true;
    else if (k === "--no-verify") a.verify = false;
    else throw new Error(`Option inconnue : ${k}`);
  }
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const base = a.base ?? (a.provider === "openai" ? "https://api.openai.com" : "https://api.anthropic.com");
  const key = (a.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || "cle-factice-injectee-par-le-proxy";
  if (a.list) {
    if (a.provider !== "openai") throw new Error("--list-models : OpenAI seulement.");
    const res = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
    const j = await res.json();
    if (!res.ok) throw new Error(`Liste des modèles : HTTP ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
    console.log((j.data ?? []).map((m) => m.id).sort().join("\n"));
    return;
  }
  const prompts = readPrompts(CONSIGNES_FILE, { verify: a.verify });
  const jobs = a.provider === "openai"
    ? Object.keys(prompts).map((id) => ({ id, prompt: prompts[id] }))
    : Object.keys(prompts).filter((id) => id.startsWith("B-")).map((id) => ({ id: id.replace(/^B-/, "D-"), prompt: dPromptFor(prompts, id.replace(/^B-/, "D-")) }));
  const picked = a.only ? jobs.filter((j) => a.only.includes(j.id)) : jobs;
  if (a.dry) {
    for (const j of picked) console.log(`--- ${j.id}\n${j.prompt}\n`);
    console.log(`${picked.length} consigne(s) lue(s), empreinte du fichier ${a.verify ? "vérifiée" : "NON vérifiée"}.`);
    return;
  }
  const model = a.model ?? (a.provider === "anthropic" ? process.env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL : null);
  if (!model) throw new Error("--model est obligatoire pour OpenAI (voir --list-models). Le modèle doit être celui fixé dans le protocole gelé.");
  if (!a.out) throw new Error("--out est obligatoire (dossier des enregistrements bruts).");
  fs.mkdirSync(a.out, { recursive: true });
  for (const j of picked) {
    const file = path.join(a.out, `${j.id}.json`);
    if (fs.existsSync(file)) { console.log(`${j.id} : déjà généré, conservé (aucune régénération).`); continue; }
    const rec = await generateOne({ provider: a.provider, base, model, id: j.id, prompt: j.prompt, maxTokens: a.maxTokens, key });
    fs.writeFileSync(file, JSON.stringify(rec, null, 2));
    console.log(`${j.id} : ${rec.failed ? "ÉCHEC sans réponse" : `${rec.modelReturned ?? "?"}, ${rec.finish ?? "?"}, ${rec.text ? rec.text.length : 0} caractères`}`);
    if (rec.failed || rec.finish === "length" || rec.finish === "max_tokens") console.log(`  ! à consigner dans le journal : ${rec.failed ? "échec" : "réponse coupée (plafond atteint)"}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
}
