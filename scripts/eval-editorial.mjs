#!/usr/bin/env node
// Évaluation comparative du moteur éditorial (voir docs/eval-editorial/README.md).
//
// Versions comparées sur les MÊMES briefs et les MÊMES profils :
//   A  moteur actuel (référence)   B  garde-fous factuels + advisory (serveur lancé avec EDITORIAL_ENGINE=B)   C  B + étape explicite d'angle
//   D  Claude utilisé directement (témoin)   E  D+ : Claude direct avec la même frontière factuelle que B (isole l'effet de la règle de celui de l'orchestration)
// Le moteur ne change pas via ce script : on lance le serveur dans la variante voulue, puis on indique l'étiquette avec --version.
//
// Commandes :
//   setup                      crée les comptes d'évaluation (exige DEMO_EDITORIALE_DB_OK=1, base jetable)
//   run --version A --set explo [--runs 1] [--base http://localhost:3100] [--brief id] [--profile wharf]
//   blind --set explo          écrit la feuille de relecture à l'aveugle + la clé + le modèle de notes
//   report --set explo         agrège coût, durée, longueur, détails à vérifier et, si notés, les scores
//
// Variables : DATABASE_URL (base jetable), ANTHROPIC_API_KEY (version D seulement), ANTHROPIC_MODEL.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { IDENTITIES, PROFILE_FIELDS } from "../lib/demoEditorialCore.mjs";
import { cleanDirect, cleanDirectDetailed } from "../lib/evalEditorialCore.mjs";
import { FACT_BOUNDARY_INSTRUCTION } from "../lib/linkedinRules.js";

const DIR = path.join(process.cwd(), "data", "eval-editorial");
const RESULTS = path.join(DIR, "results.jsonl");
const BRIEFS = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs", "eval-editorial", "briefs.json"), "utf8"));
const PROFILES = ["wharf", "aster", "axiome"];
// Consigne de style neutre : volontairement SANS la phrase « aucun chiffre inventé » de la démonstration, pour ne pas aider le moteur.
const EVAL_STYLE = "Phrases courtes et concrètes. Aucun jargon. Pas d'exagération.";
const PRICE = { in: 3, out: 15 }; // USD / million de tokens, comme lib/usage.js
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const WEIGHTS = { angle: 25, fidelite: 25, raisonnement: 20, rigueur: 20, redaction: 10 };

const canonVersion = (v) => { const u = String(v ?? "").trim().toUpperCase(); return u === "B2B" ? "B2b" : u; };
const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const emailOf = (id) => `eval-${id}@demo.invalid`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJson = (f, v, mode) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n", mode ? { mode } : undefined); };
// Nettoyage du témoin D : lib/evalEditorialCore.mjs (tests : scripts/eval-editorial.test.mjs). Le texte brut reste intact dans results.jsonl ;
// le nettoyage est appliqué à la lecture, de façon déterministe, et chaque suppression est consignée (commande « cleanreport »).
const readResultsRaw = () => (fs.existsSync(RESULTS) ? fs.readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const readResults = () => (fs.existsSync(RESULTS) ? fs.readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.failed) : []).map((r) => {
  if (r.version !== "D" && r.version !== "E") return r;
  const brief = [...BRIEFS.explo, ...BRIEFS.val].find((b) => b.id === r.briefId);
  const text = cleanDirect(r.text);
  return { ...r, raw: r.text, text, chars: text.length, details: details(text, brief?.brief ?? "") };
});
const identity = (id) => IDENTITIES.find((i) => i.id === id);
const evalProfile = (id) => ({ ...identity(id).profile, styleNotes: EVAL_STYLE });

// ── Détails à vérifier (lecture mécanique, sans IA) : tout ce qui ressemble à un fait précis absent du brief ─────────────────
const NUMWORD = "une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt|trente|quarante|cinquante|cent|plusieurs|quelques";
const UNIT = "heures?|minutes?|jours?|semaines?|mois|ans?|années?|fois";
export function details(text, brief) {
  const b = brief.toLowerCase();
  const out = new Set();
  for (const m of text.matchAll(/\d[\d  .,]*\s?(%|€|k€|M€|heures?|h\b|jours?|semaines?|mois|ans?|minutes?|min\b)?/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits && !b.replace(/\D/g, " ").split(/\s+/).includes(digits) && !b.includes(m[0].trim().toLowerCase())) out.add(`chiffre : « ${m[0].trim()} »`);
  }
  for (const m of text.matchAll(new RegExp(`\\b(${NUMWORD})\\s+(${UNIT})\\b`, "gi"))) if (!b.includes(m[0].toLowerCase())) out.add(`durée : « ${m[0]} »`);
  for (const m of text.matchAll(/[«"“]([^»"”]{8,}?)[»"”]/g)) if (!b.includes(m[1].toLowerCase())) out.add(`citation : « ${m[1].slice(0, 60)} »`);
  for (const m of text.matchAll(/(a permis de (réduire|gagner|économiser|diminuer)|a réduit|ont réduit|gain de|résultat\s?:|grâce à|à l'origine de|reconduit|hérit)[^.\n]{0,60}/gi)) out.add(`résultat ou cause affirmé : « ${m[0].trim()} »`);
  for (const m of text.matchAll(/(coûts?|délais?|temps|charges?)[^.\n]{0,40}(allég|réduit|diminu|baiss|amélior|raccourc)[^.\n]{0,30}/gi)) out.add(`résultat ou cause affirmé : « ${m[0].trim()} »`);
  return [...out];
}

// ── setup ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function setup() {
  if (process.env.DEMO_EDITORIALE_DB_OK !== "1") fail("Refusé : DEMO_EDITORIALE_DB_OK=1 confirme que DATABASE_URL est une base jetable.");
  const bcrypt = (await import("bcryptjs")).default;
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const accounts = readJson(path.join(DIR, "accounts.json"), {});
  for (const id of PROFILES) {
    const email = emailOf(id);
    const password = accounts[id]?.password ?? crypto.randomBytes(18).toString("base64url");
    const p = evalProfile(id);
    const data = { name: `Éval ${identity(id).name}`, plan: "pro", trialEndsAt: new Date(Date.now() + 90 * 86400000), planUpdatedAt: new Date(), onboardedAt: new Date(), expertise: identity(id).expertise, ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f, p[f] ?? null])) };
    const hash = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) await prisma.user.update({ where: { email }, data: { ...data, password: hash, disabled: false } });
    else await prisma.user.create({ data: { email, password: hash, ...data } });
    accounts[id] = { email, password };
    console.log(`  prêt : ${email}`);
  }
  writeJson(path.join(DIR, "accounts.json"), accounts, 0o600);
  await prisma.$disconnect();
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function login(base, email, password) {
  const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  if (!r.ok || !cookie) fail(`Connexion impossible pour ${email} (${r.status}). Avez-vous lancé « setup » ?`);
  return cookie;
}

function directPrompt(p, brief, maxChars) {
  const lines = [["Entreprise", p.companyName], ["Titre", p.headline], ["Activité", p.businessDescription], ["Public cible", p.targetAudience], ["Marché et positionnement", p.market], ["Objectifs de communication", p.commGoals], ["Ligne éditoriale", p.editorialLine], ["Consignes de style", p.styleNotes]].filter(([, v]) => v).map(([k, v]) => `- ${k} : ${v}`).join("\n");
  return `Voici le profil éditorial de mon entreprise :\n${lines}\n\nVoici l'information dont je dispose :\n${brief}\n\nRédige un post LinkedIn en français à partir de cette information, de ${maxChars} caractères au maximum.`;
}

async function run() {
  const version = canonVersion(flag("version"));
  if (!["A", "B", "B2", "B2b", "C", "D", "E"].includes(version)) fail("--version A|B|B2|B2b|C|D|E requis.");
  const direct = version === "D" || version === "E";
  const set = flag("set");
  if (!BRIEFS[set]) fail("--set explo|val requis.");
  const runs = Math.max(1, Number(flag("runs", "1")) || 1);
  const first = Math.max(1, Number(flag("first", "1")) || 1); // --first 2 : numéroter à partir de la 2e génération (générations supplémentaires)
  const base = (flag("base", "http://localhost:3100")).replace(/\/$/, "");
  const maxChars = 1300;
  const accounts = readJson(path.join(DIR, "accounts.json"), null);
  if (!accounts && !direct) fail("Lancez d'abord « setup ».");
  let prisma = null;
  if (!direct) { const { PrismaClient } = await import("@prisma/client"); prisma = new PrismaClient(); }
  if (direct && !process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY absente (versions D et E).");
  const gitHead = execSync("git rev-parse --short HEAD").toString().trim();
  const briefs = BRIEFS[set].filter((b) => !flag("brief") || b.id === flag("brief"));
  const profiles = PROFILES.filter((p) => !flag("profile") || p === flag("profile"));
  const total = briefs.length * profiles.length * runs;
  let done = 0;
  for (const pid of profiles) {
    const cookie = !direct ? await login(base, accounts[pid].email, accounts[pid].password) : null;
    const userId = prisma ? (await prisma.user.findUnique({ where: { email: accounts[pid].email }, select: { id: true } })).id : null;
    for (const b of briefs) for (let n = first; n < first + runs; n++) {
      if (args.includes("--skip-existing") && readResultsRaw().some((r) => r.version === version && r.set === set && r.briefId === b.id && r.profile === pid && r.n === n && !r.failed)) { ++done; continue; }
      const t0 = Date.now();
      let text, why = null, advisory = null, analysis = null, audit = null, guard = null, inputTokens = 0, outputTokens = 0;
      if (direct) {
        const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: directPrompt(evalProfile(pid), b.brief, maxChars) + (version === "E" ? `\n\n${FACT_BOUNDARY_INSTRUCTION}` : "") }] }) });
        if (!res.ok) fail(`API Claude (${res.status}) : arrêt, rien n'est inventé.`);
        const d = await res.json();
        text = d.content?.[0]?.text ?? ""; inputTokens = d.usage?.input_tokens ?? 0; outputTokens = d.usage?.output_tokens ?? 0;
      } else {
        const res = await fetch(`${base}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ type: "simple", theme: b.brief, expertise: identity(pid).expertise, tone: identity(pid).tone, maxChars, language: "fr" }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.text) {
          // Un échec de génération est un résultat du produit (JSON invalide, API) : on le consigne, sans rien inventer, et on continue.
          fs.mkdirSync(DIR, { recursive: true });
          fs.appendFileSync(RESULTS, JSON.stringify({ runId: crypto.randomBytes(5).toString("hex"), version, set, briefId: b.id, profile: pid, n, failed: true, error: `${res.status} ${body.error ?? "?"}`, ms: Date.now() - t0, at: new Date().toISOString(), gitHead }) + "\n");
          console.log(`  [${++done}/${total}] ${version} ${b.id} ${pid} #${n}  ÉCHEC (${res.status}) consigné`);
          continue;
        }
        text = body.text; why = body.why ?? null; advisory = body.advisory ?? null; analysis = body.analysis ?? null; audit = body.audit ?? null; guard = body.guard ?? null;
        for (let k = 0; k < 20; k++) { // l'enregistrement de consommation se fait en tâche de fond : on lit l'événement créé depuis le début de cet appel
          const ev = await prisma.usageEvent.findMany({ where: { userId, createdAt: { gte: new Date(t0) } }, orderBy: { createdAt: "asc" } });
          if (ev.length) { inputTokens = ev.reduce((s, e) => s + e.inputTokens, 0); outputTokens = ev.reduce((s, e) => s + e.outputTokens, 0); break; }
          await sleep(250);
        }
      }
      const ms = Date.now() - t0;
      const rec = { runId: crypto.randomBytes(5).toString("hex"), version, set, briefId: b.id, profile: pid, n, text, why, advisory, analysis, audit, guard, chars: text.length, ms, inputTokens, outputTokens, costUsd: (inputTokens / 1e6) * PRICE.in + (outputTokens / 1e6) * PRICE.out, model: MODEL, gitHead, at: new Date().toISOString(), details: details(text, b.brief) };
      fs.mkdirSync(DIR, { recursive: true });
      fs.appendFileSync(RESULTS, JSON.stringify(rec) + "\n");
      console.log(`  [${++done}/${total}] ${version} ${b.id} ${pid} #${n}  ${rec.chars} car.  ${(ms / 1000).toFixed(1)} s  ${inputTokens}+${outputTokens} tok  ${rec.details.length} détail(s) à vérifier`);
    }
  }
  if (prisma) await prisma.$disconnect();
}

// ── blind ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const bid = (runId) => "T" + crypto.createHash("sha256").update("eval-" + runId).digest("hex").slice(0, 5).toUpperCase();

// --versions B,E : ne présenter que ces versions (les clés et les notes déjà saisies pour les autres sont conservées)
const onlyVersions = () => (flag("versions") ? flag("versions").split(",").map(canonVersion) : null);
const tagOf = (only) => (only ? `-${only.join("")}` : "");
// --anchors N : ajoute N textes A et B déjà notés, sous de nouveaux identifiants anonymes, pour mesurer la dérive du barème entre deux séances de notation
function anchorRows(set) {
  const n = Number(flag("anchors", "0")); if (!n) return [];
  const sc = readJson(path.join(DIR, `scores-${set}.json`), {});
  const all = readResults().filter((r) => r.set === set && ["A", "B"].includes(r.version) && r.n === 1 && sc[bid(r.runId)] && typeof sc[bid(r.runId)].angle === "number");
  const pick = (v, k) => { const g = all.filter((r) => r.version === v).sort((a, b) => bid(a.runId).localeCompare(bid(b.runId))); const step = Math.max(1, Math.floor(g.length / k)); return g.filter((_, i) => i % step === 0).slice(0, k); };
  const tag = flag("anchor-tag", ""); // --anchor-tag b2b : nouveaux identifiants anonymes (même textes) pour une nouvelle mesure de dérive
  return [...pick("A", Math.ceil(n / 2)), ...pick("B", Math.floor(n / 2))].map((r) => ({ ...r, _anchorOf: bid(r.runId), runId: `${r.runId}:anchor${tag ? "-" + tag : ""}` }));
}

function blind() {
  const set = flag("set");
  if (!BRIEFS[set]) fail("--set explo|val requis.");
  const only = onlyVersions();
  const rows = readResults().filter((r) => r.set === set && (!only || only.includes(r.version))).concat(anchorRows(set));
  if (!rows.length) fail("Aucun résultat pour ce jeu.");
  const key = {}; const template = {};
  let md = `# Relecture à l'aveugle — jeu « ${set} »\n\nLes textes sont mélangés et anonymes : vous ne savez pas quelle version les a produits. Notez chaque texte de 0 à 5 sur :\n\n`;
  md += `- **angle** (25 %) : pertinence et singularité de l'angle pour cette marque\n- **fidelite** (25 %) : fidélité au positionnement, à la conviction et à la cible\n- **raisonnement** (20 %) : l'argumentation défend-elle une idée juste, distinctive et utile ?\n- **rigueur** (20 %) : tout ce qui est affirmé figure-t-il dans « Faits établis » ?\n- **redaction** (10 %) : qualité d'écriture\n- **bloquant** : \`true\` si le texte affirme comme un fait quelque chose de la liste « Non connu » (invention significative). Un texte bloquant n'est pas diffusable, quelle que soit sa note.\n- **jugement** : votre décision sur ce texte, parmi \`publiable\`, \`a-verifier\` (publiable après vérification d'un point précis, à noter dans \`note\`) ou \`non-publiable\` (le sujet doit être clarifié avant toute publication).\n\nLes « détails à vérifier » viennent d'une détection mécanique : ils aident la relecture, ils ne décident de rien.\n`;
  for (const b of BRIEFS[set]) for (const pid of PROFILES) {
    const group = rows.filter((r) => r.briefId === b.id && r.profile === pid);
    if (!group.length) continue;
    const p = evalProfile(pid);
    md += `\n---\n\n## ${b.id} · ${identity(pid).name}\n\n**Brief** : ${b.brief}\n\n**Faits établis** : ${b.facts.join(" ; ")}\n\n**Non connu (ne doit pas être affirmé)** : ${b.unknown.join(" ; ")}\n\n${b.expectedAdvice ? `**Attendu d'un conseiller éditorial** : ${b.expectedAdvice}\n\n` : ""}**Conviction de la marque** : ${p.editorialLine ?? "—"}  \n**Cible** : ${p.targetAudience ?? "—"}\n`;
    const shuffled = [...group].sort((a, b2) => bid(a.runId).localeCompare(bid(b2.runId)));
    for (const r of shuffled) {
      const id = bid(r.runId);
      key[id] = { version: r.version, runId: r.runId, brief: r.briefId, profile: r.profile, ...(r._anchorOf ? { anchorOf: r._anchorOf } : {}) };
      template[id] = { angle: null, fidelite: null, raisonnement: null, rigueur: null, redaction: null, bloquant: null, jugement: null, note: "" };
      md += `\n### ${id}\n\n${r.text.trim()}\n\n${r.details.length ? `*Détails à vérifier : ${r.details.join(" ; ")}*\n` : "*Aucun détail suspect repéré mécaniquement.*\n"}`;
    }
  }
  fs.writeFileSync(path.join(DIR, `blind-${set}${tagOf(only)}.md`), md);
  writeJson(path.join(DIR, `blind-${set}-key.json`), { ...readJson(path.join(DIR, `blind-${set}-key.json`), {}), ...key });
  writeJson(path.join(DIR, `scores-${set}.json`), { ...template, ...readJson(path.join(DIR, `scores-${set}.json`), {}) });
  console.log(`✓ ${Object.keys(key).length} textes anonymisés → data/eval-editorial/blind-${set}${tagOf(only)}.md (clé et notes dans le même dossier)`);
}

// ── sheet : page locale de notation (aucun envoi, sauvegarde dans le navigateur, export JSON) ──────────────────────────────────
function sheet() {
  const set = flag("set");
  if (!BRIEFS[set]) fail("--set explo|val requis.");
  const only = onlyVersions();
  const rows = readResults().filter((r) => r.set === set && (!only || only.includes(r.version))).concat(anchorRows(set));
  if (!rows.length) fail("Aucun résultat pour ce jeu.");
  const groups = [];
  for (const b of BRIEFS[set]) for (const pid of PROFILES) {
    const g = rows.filter((r) => r.briefId === b.id && r.profile === pid);
    if (!g.length) continue;
    const p = evalProfile(pid);
    groups.push({ brief: b.id, briefText: b.brief, facts: b.facts, unknown: b.unknown, advice: b.expectedAdvice ?? null, profile: identity(pid).name, conviction: p.editorialLine, target: p.targetAudience,
      texts: [...g].sort((x, y) => bid(x.runId).localeCompare(bid(y.runId))).map((r) => ({ id: bid(r.runId), text: r.text.trim(), details: r.details })) });
  }
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notation à l'aveugle — ${set}</title>
<style>:root{color-scheme:light dark;--bg:#fff;--fg:#1d2330;--mut:#667;--card:#f5f6f8;--line:#d9dce3;--acc:#2a5bd7}@media(prefers-color-scheme:dark){:root{--bg:#161a22;--fg:#e8eaf0;--mut:#9aa3b2;--card:#1f2430;--line:#323948;--acc:#7da2ff}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}main{max-width:820px;margin:0 auto;padding:16px}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:2}header b{flex:1}
button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}button.p{background:var(--acc);color:#fff;border-color:var(--acc)}
section{margin:28px 0 10px}h2{font-size:18px;margin:0 0 6px}.ctx{background:var(--card);border-radius:10px;padding:10px 14px;font-size:14px;color:var(--mut)}.ctx p{margin:4px 0}
.card{border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0}.card.done{border-color:var(--acc)}.id{font-weight:700;color:var(--acc)}
.txt{white-space:pre-wrap;margin:8px 0;font-size:16px}.det{font-size:13px;color:var(--mut)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}
label{font-size:13px;color:var(--mut);display:flex;flex-direction:column;gap:2px}select,textarea{font:inherit;padding:4px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}textarea{width:100%;box-sizing:border-box}
.blk{flex-direction:row;align-items:center;gap:6px;color:var(--fg)}</style></head><body>
<header><b>Notation à l'aveugle — jeu « ${set} »</b><span id="prog"></span><button class="p" id="exp">Exporter les notes</button></header>
<main><p class="ctx">Notez de 0 à 5 : <b>angle</b> (25 %), <b>fidélité</b> à la marque et à la cible (25 %), <b>raisonnement</b> (20 %), <b>rigueur</b> (20 %), <b>rédaction</b> (10 %). Cochez <b>bloquant</b> si le texte affirme comme un fait une chose de la liste « non connu ». Vos notes sont enregistrées automatiquement dans ce navigateur. « Exporter » télécharge <code>scores-${set}.json</code>.</p><div id="app"></div></main>
<script>const G=${JSON.stringify(groups).replace(/</g, "\\u003c")};const K="eval-${set}";let S={};try{S=JSON.parse(localStorage.getItem(K)||"{}")}catch{}
const F=["angle","fidelite","raisonnement","rigueur","redaction"],L={angle:"Angle",fidelite:"Fidélité marque/cible",raisonnement:"Raisonnement",rigueur:"Rigueur",redaction:"Rédaction"};
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch{}};
const done=id=>{const s=S[id]||{};return F.every(f=>typeof s[f]==="number")&&typeof s.bloquant==="boolean"&&s.jugement};
function prog(){const all=G.flatMap(g=>g.texts);document.getElementById("prog").textContent=all.filter(t=>done(t.id)).length+" / "+all.length+" notés"}
function set(id,k,v){S[id]=S[id]||{};S[id][k]=v;save();prog();document.getElementById("c"+id).classList.toggle("done",!!done(id))}
document.getElementById("app").innerHTML=G.map(g=>'<section><h2>'+esc(g.brief)+' · '+esc(g.profile)+'</h2><div class="ctx"><p><b>Brief :</b> '+esc(g.briefText)+'</p><p><b>Faits établis :</b> '+esc(g.facts.join(" ; "))+'</p><p><b>Non connu (ne doit pas être affirmé) :</b> '+esc(g.unknown.join(" ; "))+'</p>'+(g.advice?'<p><b>Attendu d\\'un conseiller éditorial :</b> '+esc(g.advice)+'</p>':'')+'<p><b>Conviction de la marque :</b> '+esc(g.conviction||"—")+'</p><p><b>Cible :</b> '+esc(g.target||"—")+'</p></div>'+g.texts.map(t=>{const s=S[t.id]||{};return '<div class="card'+(done(t.id)?' done':'')+'" id="c'+t.id+'"><span class="id">'+t.id+'</span><div class="txt">'+esc(t.text)+'</div><div class="det">'+(t.details.length?'Détails à vérifier : '+esc(t.details.join(" ; ")):'Aucun détail suspect repéré mécaniquement.')+'</div><div class="grid">'+F.map(f=>'<label>'+L[f]+'<select data-i="'+t.id+'" data-k="'+f+'"><option value="">—</option>'+[0,1,2,3,4,5].map(n=>'<option'+(s[f]===n?' selected':'')+'>'+n+'</option>').join("")+'</select></label>').join("")+'<label class="blk"><input type="checkbox" data-i="'+t.id+'" data-k="bloquant"'+(s.bloquant?' checked':'')+'> Bloquant</label><label>Jugement<select data-i="'+t.id+'" data-k="jugement"><option value="">—</option>'+["publiable","a-verifier","non-publiable"].map(o=>'<option'+(s.jugement===o?' selected':'')+'>'+o+'</option>').join("")+'</select></label></div><label style="margin-top:8px">Note (facultatif)<textarea rows="2" data-i="'+t.id+'" data-k="note">'+esc(s.note||"")+'</textarea></label></div>'}).join("")+'</section>').join("");
document.getElementById("app").addEventListener("change",e=>{const el=e.target,i=el.dataset.i,k=el.dataset.k;if(!i)return;if(el.type==="checkbox")set(i,k,el.checked);else if(F.includes(k))set(i,k,el.value===""?null:Number(el.value));else set(i,k,el.value)});
document.getElementById("app").addEventListener("input",e=>{if(e.target.dataset.k==="note")set(e.target.dataset.i,"note",e.target.value)});
document.getElementById("exp").onclick=()=>{const out={};G.flatMap(g=>g.texts).forEach(t=>{const s=S[t.id]||{};out[t.id]={angle:s.angle??null,fidelite:s.fidelite??null,raisonnement:s.raisonnement??null,rigueur:s.rigueur??null,redaction:s.redaction??null,bloquant:typeof s.bloquant==="boolean"?s.bloquant:null,jugement:s.jugement||null,note:s.note||""}});const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:"application/json"}));a.download="scores-${set}.json";a.click()};prog();</script></body></html>`;
  fs.writeFileSync(path.join(DIR, `notation-${set}${tagOf(only)}.html`), html);
  console.log(`✓ data/eval-editorial/notation-${set}${tagOf(only)}.html (${groups.reduce((n, g) => n + g.texts.length, 0)} textes)`);
}

// ── conseilsheet : réponse ORIGINALE complète des cas sensibles (briefs incomplets et contradictoires), pour évaluer détecter / conseiller / décider ──
function conseilsheet() {
  const set = flag("set"); if (!BRIEFS[set]) fail("--set explo|val requis.");
  const only = onlyVersions();
  const rows = fs.readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.failed && r.set === set && (!only || only.includes(r.version)));
  let md = `# Évaluation du conseil — jeu « ${set} »\n\nPour chaque cas sensible : le post, puis la **réponse originale complète** (champ \`why\`, champ \`advisory\` s'il existe, commentaires de l'assistant autour du post). Notez de 0 à 2 : **detecter**, **conseiller**, **decider** (grille dans docs/eval-editorial/README.md), avec une justification courte, et précisez si l'avertissement est **accessible** à l'utilisateur dans le fonctionnement normal.\n`;
  const ids = [];
  for (const b of BRIEFS[set].filter((x) => x.expectedAdvice)) for (const pid of PROFILES) for (const r of rows.filter((x) => x.briefId === b.id && x.profile === pid).sort((x, y) => bid(x.runId).localeCompare(bid(y.runId)))) {
    ids.push(bid(r.runId));
    const raw = fs.readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((x) => x.runId === r.runId);
    const comments = (r.version === "D" || r.version === "E") ? cleanDirectDetailed(raw.text).removed.filter((x) => x.kind === "commentaire").map((x) => x.text) : [];
    const whyLine = r.why ? "- champ why : " + JSON.stringify({ hook: r.why.hook, structure: r.why.structure, cta: r.why.cta, hashtags: r.why.hashtags }) + "\n" : "";
    const advLine = r.advisory ? "- champ advisory : " + JSON.stringify(r.advisory) + "\n" : "";
    const comLines = comments.map((c) => "- Commentaire de l'assistant : « " + c.replace(/\n+/g, " ⏎ ") + " »\n").join("");
    const none = !r.why && !r.advisory && !comments.length ? "- Aucun élément autour du post.\n" : "";
    md += "\n---\n\n## " + bid(r.runId) + " · " + b.id + " · " + identity(pid).name + "\n\n**Brief** : " + b.brief + "\n\n**Attendu d'un conseiller éditorial** : " + b.expectedAdvice + "\n\n**Post** :\n\n" + r.text.trim() + "\n\n**Réponse originale complète** :\n\n" + whyLine + advLine + comLines + none;
  }
  fs.writeFileSync(path.join(DIR, `conseil-${set}${tagOf(only)}.md`), md);
  console.log(`✓ ${ids.length} cas → data/eval-editorial/conseil-${set}${tagOf(only)}.md`);
}

// ── import : fusionner un fichier de notes exporté (scores ou conseil) dans ceux du dossier, sans écraser les notes existantes ─────
function importNotes() {
  const set = flag("set"); const kind = flag("kind", "scores"); const file = flag("file");
  if (!BRIEFS[set] || !file || !["scores", "conseil"].includes(kind)) fail("import --set explo --kind scores|conseil --file chemin.json");
  const incoming = readJson(file, null); if (!incoming) fail("Fichier illisible.");
  const dest = path.join(DIR, `${kind}-${set}.json`); const cur = readJson(dest, {}); const key = readJson(path.join(DIR, `blind-${set}-key.json`), {});
  const unknown = Object.keys(incoming).filter((id) => !key[id]); if (unknown.length) fail(`Identifiants inconnus : ${unknown.join(", ")}`);
  let n = 0; for (const [id, v] of Object.entries(incoming)) { cur[id] = v; n++; }
  writeJson(dest, cur); console.log(`✓ ${n} notation(s) fusionnée(s) dans ${path.relative(process.cwd(), dest)} (${Object.keys(cur).length} au total)`);
}

// ── compare : comparatif apparié X → Y (mêmes briefs, mêmes profils), après levée de l'aveugle ───────────────────────────────────
function compare() {
  const set = flag("set"), from = canonVersion(flag("from")), to = canonVersion(flag("to"));
  if (!BRIEFS[set] || !from || !to) fail("compare --set explo --from A --to B");
  const key = readJson(path.join(DIR, `blind-${set}-key.json`), {}), sc = readJson(path.join(DIR, `scores-${set}.json`), {}), co = readJson(path.join(DIR, `conseil-${set}.json`), {});
  const rows = readResults().filter((r) => r.set === set);
  const idOf = (r) => bid(r.runId);
  const by = (v) => Object.fromEntries(rows.filter((r) => r.version === v && r.n === 1).map((r) => [`${r.briefId}|${r.profile}`, r]));
  const X = by(from), Y = by(to);
  const pairs = Object.keys(X).filter((k) => Y[k] && sc[idOf(X[k])] && sc[idOf(Y[k])]);
  const keys = ["angle", "fidelite", "raisonnement", "rigueur", "redaction"];
  const ws = (v) => Object.entries(WEIGHTS).reduce((t, [k, w]) => t + (v[k] / 5) * w, 0);
  const side = (M) => {
    const rs = pairs.map((k) => M[k]), ss = rs.map((r) => sc[idOf(r)]);
    const sens = rs.filter((r) => co[idOf(r)]);
    const cs = sens.map((r) => co[idOf(r)]);
    const sim = []; for (const b of BRIEFS[set]) { const t = PROFILES.map((p) => M[`${b.id}|${p}`]?.text).filter(Boolean); for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) sim.push(jac(t[i], t[j])); }
    return { n: rs.length, score: +avg(ss.map(ws)).toFixed(1), ...Object.fromEntries(keys.map((k) => [k, +avg(ss.map((v) => v[k])).toFixed(2)])),
      bloquants: ss.filter((v) => v.bloquant).length, publiable: ss.filter((v) => v.jugement === "publiable").length, nonPubliable: ss.filter((v) => v.jugement === "non-publiable").length,
      scoreNonBloquants: ss.filter((v) => !v.bloquant).length ? +avg(ss.filter((v) => !v.bloquant).map(ws)).toFixed(1) : null,
      conseil: cs.length ? { cas: cs.length, detecter: +avg(cs.map((c) => c.detecter)).toFixed(2), conseiller: +avg(cs.map((c) => c.conseiller)).toFixed(2), decider: +avg(cs.map((c) => c.decider)).toFixed(2), accessibles: cs.filter((c) => /^oui/.test(c.accessible ?? "")).length } : null,
      longueur: Math.round(avg(rs.map((r) => r.chars))), dureeS: +(avg(rs.map((r) => r.ms)) / 1000).toFixed(1), coutUsd: +avg(rs.map((r) => r.costUsd)).toFixed(4), tokensEntree: Math.round(avg(rs.map((r) => r.inputTokens))), tokensSortie: Math.round(avg(rs.map((r) => r.outputTokens))), similariteInterProfils: +avg(sim).toFixed(3),
      advisory: rs.some((r) => r.advisory) ? Object.fromEntries(["ready", "verify", "blocked"].map((st) => [st, rs.filter((r) => r.advisory?.status === st).length])) : undefined };
  };
  const detail = pairs.map((k) => { const a = sc[idOf(X[k])], b = sc[idOf(Y[k])]; return { cas: k.replace("explo-", "").replace("val-", ""), [from]: Math.round(ws(a)), [to]: Math.round(ws(b)), delta: Math.round(ws(b) - ws(a)), rigueur: `${a.rigueur}→${b.rigueur}`, bloquant: `${a.bloquant ? "oui" : "non"}→${b.bloquant ? "oui" : "non"}`, angle: `${a.angle}→${b.angle}`, fidelite: `${a.fidelite}→${b.fidelite}`, raisonnement: `${a.raisonnement}→${b.raisonnement}` }; });
  const wins = detail.filter((d) => d.delta > 0).length, losses = detail.filter((d) => d.delta < 0).length;
  console.log(JSON.stringify({ comparaison: `${from} → ${to}`, paires: pairs.length, victoires: { [to]: wins, [from]: losses, egalites: pairs.length - wins - losses }, [from]: side(X), [to]: side(Y), detail }, null, 1));
}

// ── dossier : page locale de relecture humaine ciblée (versions révélées, côte à côte) ───────────────────────────────────────────
function dossier() {
  const set = flag("set", "explo");
  const versions = (flag("versions", "A,B,D,E")).split(",").map(canonVersion);
  const suite = versions.join(",") !== "A,B,D,E";
  const prevAnswers = readJson(path.join(DIR, "dossier-decision-B2-reponses.json"), { reponses: {} }).reponses;
  const releves = readJson(path.join(process.cwd(), "docs", "eval-editorial", "dossier-releves.json"), null); if (!releves) fail("docs/eval-editorial/dossier-releves.json manquant.");
  const key = readJson(path.join(DIR, `blind-${set}-key.json`), {}), sc = readJson(path.join(DIR, `scores-${set}.json`), {});
  const rows = readResults().filter((r) => r.set === set);
  const rawRows = fs.readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const defs = [
    { t: "1. Invention factuelle significative", d: "Un acteur, une durée, une cause ou origine, un résultat, une décision, une citation ou un contenu de programme présentés comme acquis alors que le brief ne les donne pas. Ex. : « simplification retenue »." },
    { t: "2. Hypothèse légitime et identifiée", d: "Une interprétation clairement marquée (conditionnel, « peut-être », « nous pensons »), compatible avec le brief. Ex. : « elles mesurent peut-être des choses différentes »." },
    { t: "3. Manque d'information empêchant la publication", d: "Le texte n'invente rien mais ne peut pas être publié faute d'un fait nécessaire, ou parce que le brief se contredit. Ex. : le nom du prix." },
    { t: "4. Simple choix de formulation", d: "Accroche, ton, tournure, sans conséquence factuelle. Ex. : une accroche logiquement confuse mais qui n'affirme aucun fait." },
  ];
  const sections = releves.sections.map((sec) => ({ ...sec, cases: sec.cases.map((ck) => {
    const [bk, pid] = ck.split("|"); const b = BRIEFS[set].find((x) => x.id === `explo-${bk}`);
    const texts = versions.map((v) => {
      const r = rows.find((x) => x.version === v && x.briefId === b.id && x.profile === pid && x.n === 1); const id = bid(r.runId);
      const pv = prevAnswers[`${bk}|${pid}|${v}`];
      const raw = rawRows.find((x) => x.runId === r.runId);
      const comments = (v === "D" || v === "E") ? cleanDirectDetailed(raw.text).removed.filter((x) => x.kind === "commentaire").map((x) => x.text) : [];
      return { version: v, id, text: r.text.trim(), details: r.details, ai: sc[id] ?? { angle: "—", fidelite: "—", raisonnement: "—", rigueur: "—", redaction: "—", bloquant: false, jugement: "pas encore noté", note: "Pas encore noté par la première lecture." },
        prev: pv ? `angle ${pv.angle} · fidélité ${pv.fidelite} · invention ${pv.cat_invention ? "oui" : "non"} · hypothèse ${pv.cat_hypothese ? "oui" : "non"} · manque ${pv.cat_manque ? "oui" : "non"} · recommandation ${pv.reco}\n${pv.passages ?? ""}` : null, advisory: r.advisory ?? null, comments, why: v === "A" || v === "B" ? (r.why ? { hook: r.why.hook, structure: r.why.structure, cta: r.why.cta, hashtags: r.why.hashtags } : null) : null };
    });
    return { key: ck, label: `${identity(pid).name} · ${bk}`, brief: b.brief, facts: b.facts, unknown: b.unknown, advice: b.expectedAdvice ?? null, conviction: evalProfile(pid).editorialLine, contradiction: bk === "contradictoire", reading: releves.readings[ck] ?? [], texts };
  }) }));
  const html = fs.readFileSync(path.join(process.cwd(), "scripts", "dossier-template.html"), "utf8").replace("__DATA__", JSON.stringify({ meta: { key: suite ? "dossier-b2-suite" : "dossier-b2", file: suite ? "dossier-decision-B2-suite-reponses.json" : "dossier-decision-B2-reponses.json" }, defs, sections }).replace(/</g, "\\u003c"));
  fs.writeFileSync(path.join(DIR, suite ? "dossier-decision-B2-suite.html" : "dossier-decision-B2.html"), html);
  console.log(`✓ data/eval-editorial/dossier-decision-B2${suite ? "-suite" : ""}.html (${sections.reduce((n, x) => n + x.cases.reduce((m, c) => m + c.texts.length, 0), 0)} textes)`);
}

// ── cleanreport : ce que le nettoyage retire de chaque texte D, pour vérifier qu'aucun argument ne disparaît ───────────────────
function cleanreport() {
  const raws = fs.existsSync(RESULTS) ? fs.readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.version === "D" || r.version === "E") : [];
  if (!raws.length) fail("Aucun texte D.");
  let md = `# Rapport de nettoyage du témoin D\n\nPour chacun des ${raws.length} textes D : ce qui a été retiré (présentation extérieure au post) et ce qui est conservé. Les sorties brutes restent intactes dans \`results.jsonl\`. Règle : tout bloc non reconnu comme présentation est conservé, même entre deux séparateurs.\n\n⚠ = le passage retiré est un **commentaire** de Claude (note ou conseil) : il peut contenir un avis éditorial utile à la lecture du critère « conseiller ».\n`;
  let flagged = 0;
  for (const r of raws) {
    const { text, removed } = cleanDirectDetailed(r.text);
    const advice = removed.filter((x) => x.kind === "commentaire");
    const seps = removed.filter((x) => x.kind === "séparateur").length;
    if (advice.length) flagged++;
    md += `\n## ${bid(r.runId)} · ${r.briefId} · ${r.profile}\n\n- Brut : ${r.text.length} caractères · après nettoyage : ${text.length} (${Math.round((100 * text.length) / r.text.length)} %)\n- Séparateurs « --- » retirés : ${seps}\n`;
    for (const x of removed.filter((x) => x.kind !== "séparateur")) md += `- ${x.kind === "commentaire" ? "⚠ " : ""}**${x.kind}** retiré${x.kind === "mise en forme" ? "" : " :"} ${x.kind === "mise en forme" ? x.text : `« ${x.text.replace(/\n+/g, " ⏎ ")} »`}\n`;
    if (!removed.some((x) => !["séparateur", "mise en forme"].includes(x.kind))) md += `- Aucun passage de texte retiré (séparateurs et mise en forme seulement).\n`;
  }
  md += `\n---\n\n**Synthèse** : ${flagged} texte(s) sur ${raws.length} avec un commentaire de Claude retiré (⚠).\n`;
  fs.writeFileSync(path.join(DIR, "rapport-nettoyage-D.md"), md);
  console.log(`✓ data/eval-editorial/rapport-nettoyage-D.md (${raws.length} textes, ${flagged} avec commentaire retiré)`);
}

// ── report ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const tok = (t) => new Set(String(t).toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ]{5,}/g) ?? []);
const jac = (a, b) => { const A = tok(a), B = tok(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

function report() {
  const set = flag("set");
  const rows = readResults().filter((r) => r.set === set);
  if (!rows.length) fail("Aucun résultat.");
  const scores = readJson(path.join(DIR, `scores-${set}.json`), {});
  const key = readJson(path.join(DIR, `blind-${set}-key.json`), {});
  const byRun = Object.fromEntries(Object.entries(key).map(([id, k]) => [k.runId, id]));
  const out = [];
  for (const v of ["A", "B", "B2", "B2b", "C", "D", "E"]) {
    const g = rows.filter((r) => r.version === v);
    if (!g.length) continue;
    // Différenciation : similarité moyenne entre les trois profils sur un même brief (plus bas = plus distinctes)
    const sims = [];
    for (const b of BRIEFS[set]) { const t = PROFILES.map((p) => g.find((r) => r.briefId === b.id && r.profile === p)?.text).filter(Boolean); for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) sims.push(jac(t[i], t[j])); }
    const sc = g.map((r) => scores[byRun[r.runId]]).filter((s) => s && WEIGHTS && Object.keys(WEIGHTS).every((k) => typeof s[k] === "number"));
    const weighted = sc.map((s) => Object.entries(WEIGHTS).reduce((t, [k, w]) => t + (s[k] / 5) * w, 0));
    out.push({
      version: v, textes: g.length, longueurMoyenne: Math.round(avg(g.map((r) => r.chars))), dureeMoyenneS: +(avg(g.map((r) => r.ms)) / 1000).toFixed(1),
      tokensEntreeMoy: Math.round(avg(g.map((r) => r.inputTokens))), tokensSortieMoy: Math.round(avg(g.map((r) => r.outputTokens))), coutMoyenUsd: +avg(g.map((r) => r.costUsd)).toFixed(4),
      echecsDeGeneration: readResultsRaw().filter((r) => r.failed && r.version === v && r.set === set).length || undefined,
      fiabiliteAdvisory: (() => { const x = g.filter((r) => r.advisory).map((r) => ({ r, s: scores[byRun[r.runId]] })).filter((o) => o.s && typeof o.s.angle === "number"); if (!x.length) return undefined;
        const by = (st) => ({ avecInvention: x.filter((o) => o.r.advisory.status === st && o.s.bloquant).length, sansInvention: x.filter((o) => o.r.advisory.status === st && !o.s.bloquant).length });
        const inv = x.filter((o) => o.s.bloquant);
        return { ready: by("ready"), verify: by("verify"), blocked: by("blocked"), inventionsNonReady: `${inv.filter((o) => o.r.advisory.status !== "ready").length}/${inv.length}`, inventionsMalgreReady: inv.filter((o) => o.r.advisory.status === "ready").length, nonReadySansInvention: x.filter((o) => !o.s.bloquant && o.r.advisory.status !== "ready").length }; })(),
      audit: (() => { const x = g.filter((r) => r.audit).map((r) => ({ r, s: scores[byRun[r.runId]] })).filter((o) => o.s && typeof o.s.angle === "number"); if (!x.length) return undefined;
        const inv = x.filter((o) => o.s.bloquant), clean = x.filter((o) => !o.s.bloquant), flagged = (o) => o.r.audit.unsupported.length > 0;
        return { textes: x.length, detection: `${inv.filter(flagged).length}/${inv.length}`, fauxPositifs: `${clean.filter(flagged).length}/${clean.length}`, affirmationsSignaleesParTexte: +avg(x.map((o) => o.r.audit.unsupported.length)).toFixed(2), citationsIntrouvables: x.reduce((t, o) => t + o.r.audit.unsupported.filter((u) => u.found === false).length, 0), hypothesesParTexte: +avg(x.map((o) => o.r.audit.hypotheses.length)).toFixed(2) }; })(),
      advisory: g.some((r) => r.advisory) ? Object.fromEntries(["ready", "verify", "blocked"].map((k) => [k, g.filter((r) => r.advisory?.status === k).length])) : undefined,
      detailsAVerifierParTexte: +avg(g.map((r) => r.details.length)).toFixed(2), textesSansDetailSuspect: g.filter((r) => !r.details.length).length,
      similariteInterProfils: +avg(sims).toFixed(3),
      notes: sc.length ? { notes: sc.length, scoreSur100: +avg(weighted).toFixed(1), bloquants: sc.filter((s) => s.bloquant === true).length, ...Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, +avg(sc.map((s) => s[k])).toFixed(2)])) } : "non noté",
    });
  }
  // Dérive du barème : les textes d'ancrage (déjà notés) sont renotés sous de nouveaux identifiants ; l'écart moyen mesure la dérive entre séances
  const anchors = Object.entries(key).filter(([id, k]) => k.anchorOf && scores[id] && typeof scores[id].angle === "number" && scores[k.anchorOf]);
  const drift = anchors.length ? (() => { const wsv = (v) => Object.entries(WEIGHTS).reduce((t, [kk, w]) => t + (v[kk] / 5) * w, 0); return { ancres: anchors.length, ecartMoyenScoreSur100: +avg(anchors.map(([id, k]) => wsv(scores[id]) - wsv(scores[k.anchorOf]))).toFixed(1), ecartAbsoluMoyen: +avg(anchors.map(([id, k]) => Math.abs(wsv(scores[id]) - wsv(scores[k.anchorOf])))).toFixed(1), changementsDeBloquant: anchors.filter(([id, k]) => scores[id].bloquant !== scores[k.anchorOf].bloquant).length }; })() : "aucune ancre notée";
  console.log(JSON.stringify({ versions: out, deriveDuBareme: drift }, null, 2));
}

const COMMANDS = { setup, run, blind, sheet, conseilsheet, compare, dossier, import: importNotes, cleanreport, report };
if (!COMMANDS[cmd]) fail("Commande : setup | run | blind | report");
await COMMANDS[cmd]();
