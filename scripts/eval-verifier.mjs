#!/usr/bin/env node
// Banc d'essai hors ligne du vérificateur indépendant (protocole : docs/eval-editorial/verifier-protocole.md).
// Aucune génération de publication : le vérificateur lit des textes déjà générés et déjà étiquetés par les relecteurs.
//
//   prepare                              construit le jeu (étiquettes, statuts, contestées, découpage développement/validation)
//   run --model sonnet|haiku --split dev|val [--concurrency 3] [--limit N]
//   score --model sonnet|haiku --split dev|val
//   report                               rapport comparatif et décision selon les seuils annoncés
//   sample --model sonnet|haiku          échantillon de 24 sorties à noter à la main (graine fixe)
//   contestees                           fiche d'arbitrage humain des étiquettes contestées
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { IDENTITIES } from "../lib/demoEditorialCore.mjs";
import { cleanDirect } from "../lib/evalEditorialCore.mjs";
import { VERIFIER_PROMPT_VERSION, VERIFIER_SYSTEM, verifierUserPrompt, verifierPromptHash, parseVerifierOutput, anomaliesOf } from "../lib/verifierPrompt.mjs";

const DIR = path.join(process.cwd(), "data", "eval-editorial");
const VDIR = path.join(DIR, "verifier");
const EVAL_STYLE = "Phrases courtes et concrètes. Aucun jargon. Pas d'exagération.";
const MODELS = { sonnet: { id: "claude-sonnet-4-6", inPerM: 3, outPerM: 15 }, haiku: { id: "claude-haiku-4-5", inPerM: 1, outPerM: 5 } };
const SPLITS = { dev: ["explo-industrie", "explo-rh", "explo-incomplet"], val: ["explo-transformation", "explo-reglementaire", "explo-contradictoire"] };
const VERSIONS = ["A", "B", "B2", "B2b", "D", "E"];
const THRESHOLDS = { recall: 0.8, fpr: 0.2, passage: 0.7, invalid: 0.03, medianMs: 8000, costUsd: 0.012, gap: 0.15, recallReserve: 0.65, fprReserve: 0.3 };

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };
const bid = (runId) => "T" + crypto.createHash("sha256").update("eval-" + runId).digest("hex").slice(0, 5).toUpperCase();
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);
const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const profileOf = (pid) => ({ ...IDENTITIES.find((i) => i.id === pid).profile, styleNotes: EVAL_STYLE });
const outDir = (model) => path.join(VDIR, `out-${model}-${VERIFIER_PROMPT_VERSION}`);

// ── prepare ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function prepare() {
  const rows = fs.readFileSync(path.join(DIR, "results.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse).filter((r) => !r.failed && r.set === "explo" && VERSIONS.includes(r.version));
  const scores = readJson(path.join(DIR, "scores-explo.json"), {});
  const key = readJson(path.join(DIR, "blind-explo-key.json"), {});
  const second = readJson(path.join(DIR, "dossier-decision-B2-reponses.json"), { reponses: {} }).reponses;
  const briefs = Object.fromEntries(readJson(path.join(process.cwd(), "docs", "eval-editorial", "briefs.json"), {}).explo.map((b) => [b.id, b]));
  const quotes = (s) => [...String(s ?? "").matchAll(/«\s*([^»]{4,120}?)\s*»/g)].map((m) => m[1]);
  const items = [];
  for (const r of rows) {
    const id = bid(r.runId); const sc = scores[id]; if (!sc || typeof sc.angle !== "number") continue;
    const readings = [{ source: "première lecture", inv: !!sc.bloquant, note: sc.note }];
    const sk = `${r.briefId.replace("explo-", "")}|${r.profile}|${r.version}`;
    if (second[sk]) readings.push({ source: "seconde lecture (dossier)", inv: !!second[sk].cat_invention, note: second[sk].passages });
    for (const [aid, k] of Object.entries(key)) if (k.anchorOf === id && scores[aid] && typeof scores[aid].angle === "number") readings.push({ source: `relecture d'ancre ${aid}`, inv: !!scores[aid].bloquant, note: scores[aid].note });
    const yes = readings.filter((x) => x.inv).length, no = readings.length - yes;
    const contested = yes > 0 && no > 0;
    const status = readings.length === 1 ? "unique" : contested ? "contestée" : "double";
    const inv = contested ? yes > no : yes > 0; // étiquette provisoire des contestées : majorité (égalité = non), jamais utilisée pour la mesure
    const text = r.version === "D" || r.version === "E" ? cleanDirect(r.text) : r.text.trim();
    items.push({ id, version: r.version, n: r.n, briefId: r.briefId, profile: r.profile, split: SPLITS.dev.includes(r.briefId) ? "dev" : "val", briefText: briefs[r.briefId].brief, postText: text, label: { inv, status, readings }, readerQuotes: readings.flatMap((x) => quotes(x.note)) });
  }
  writeJson(path.join(VDIR, "dataset.json"), items);
  for (const sp of ["dev", "val"]) {
    const g = items.filter((i) => i.split === sp), m = g.filter((i) => i.label.status !== "contestée");
    console.log(`${sp} : ${g.length} textes (${SPLITS[sp].map((b) => b.replace("explo-", "")).join(", ")}) · étiquettes unique ${g.filter((i) => i.label.status === "unique").length}, double ${g.filter((i) => i.label.status === "double").length}, contestée ${g.filter((i) => i.label.status === "contestée").length} · mesurables : ${m.length} dont ${m.filter((i) => i.label.inv).length} inventions et ${m.filter((i) => !i.label.inv).length} propres`);
  }
  console.log(`contestées (arbitrage humain) : ${items.filter((i) => i.label.status === "contestée").map((i) => `${i.id} (${i.version}, ${i.briefId.replace("explo-", "")}/${i.profile})`).join(" ; ") || "aucune"}`);
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function callModel(model, item) {
  const cfg = MODELS[model]; let totalMs = 0, tin = 0, tout = 0, raw = "", parsed = null, retried = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: cfg.id, max_tokens: 1500, temperature: 0, system: VERIFIER_SYSTEM, messages: [{ role: "user", content: verifierUserPrompt({ briefText: item.briefText, profile: profileOf(item.profile), postText: item.postText }) }] }) });
    totalMs += Date.now() - t0;
    if (!res.ok) { raw = `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`; if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 4000 * attempt)); continue; } break; }
    const d = await res.json(); tin += d.usage?.input_tokens ?? 0; tout += d.usage?.output_tokens ?? 0; raw = d.content?.[0]?.text ?? "";
    parsed = parseVerifierOutput(raw); if (parsed) break; retried = true;
  }
  return { id: item.id, model: cfg.id, promptVersion: VERIFIER_PROMPT_VERSION, promptHash: verifierPromptHash(), ms: totalMs, inputTokens: tin, outputTokens: tout, costUsd: (tin / 1e6) * cfg.inPerM + (tout / 1e6) * cfg.outPerM, retried, valid: !!parsed, raw, parsed };
}
async function run() {
  const model = flag("model"), split = flag("split"); if (!MODELS[model] || !SPLITS[split]) fail("run --model sonnet|haiku --split dev|val");
  if (!process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY absente.");
  const items = readJson(path.join(VDIR, "dataset.json"), null); if (!items) fail("Lancez d'abord « prepare ».");
  const limit = Number(flag("limit", "0")) || Infinity, conc = Math.max(1, Number(flag("concurrency", "3")) || 3);
  const dir = outDir(model); fs.mkdirSync(dir, { recursive: true });
  const todo = items.filter((i) => i.split === split && !fs.existsSync(path.join(dir, `${i.id}.json`))).slice(0, limit);
  console.log(`${model} (${MODELS[model].id}) · prompt ${VERIFIER_PROMPT_VERSION}/${verifierPromptHash()} · ${split} : ${todo.length} textes à vérifier`);
  let done = 0, next = 0;
  const worker = async () => { while (next < todo.length) { const it = todo[next++]; const out = await callModel(model, it); fs.writeFileSync(path.join(dir, `${it.id}.json`), JSON.stringify(out, null, 2)); if (++done % 10 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`); } };
  await Promise.all(Array.from({ length: conc }, worker));
}

// ── score ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const STOP = new Set("dans pour avec cette sont leur leurs nous vous plus être avoir fait faire comme mais aussi entre très sans sous chez".split(" "));
const toks = (t) => new Set((String(t).toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ]{4,}/g) ?? []).filter((w) => !STOP.has(w)));
const overlap = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / Math.min(A.size, B.size); };

function loadOutputs(model) { const dir = outDir(model); return fs.existsSync(dir) ? Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => { const o = readJson(path.join(dir, f), null); return [f.replace(".json", ""), o]; })) : {}; }
const flagged = (out, mode) => { const a = anomaliesOf(out?.parsed); return mode === "bloquante" ? a.some((c) => c.gravite === "bloquante") : a.length > 0; };

// Arbitrage par un assistant IA (PAS une validation humaine) des faux positifs et des étiquettes contestées du développement. Les étiquettes d'origine ne sont jamais écrasées :
// le mode « arbitrated » est une analyse de sensibilité, présentée à côté du mode d'origine.
const ARB = readJson(path.join(VDIR, "arbitrage-verificateur-IA.json"), null);
// Cas où l'arbitre note un verdict juste mais un passage mal ciblé (TD1417, Sonnet) ou bien ciblé (TB3342, Sonnet) sans liste de signalements.
const PASSAGE_EXC = { TD1417: { sonnet: false }, TB3342: { sonnet: true } };
function applyArbitration(items) {
  if (!ARB) fail("arbitrage-verificateur-IA.json absent de data/eval-editorial/verifier/.");
  const fp = Object.fromEntries(ARB.arbitrage_faux_positifs_dev.map((x) => [x.id, x])), ct = Object.fromEntries(ARB.arbitrage_etiquettes_contestees.map((x) => [x.id, x]));
  return items.map((i) => { const a = fp[i.id] ?? ct[i.id]; return a ? { ...i, label: { ...i.label, inv: a.verdict_invention_significative, status: "arbitré (IA)" } } : i; });
}
function scoreOne(model, split, labels = "original") {
  let items = readJson(path.join(VDIR, "dataset.json"), []).filter((i) => i.split === split); if (labels === "arbitrated") items = applyArbitration(items); const outs = loadOutputs(model);
  const have = items.filter((i) => outs[i.id]); if (!have.length) return null;
  const measurable = have.filter((i) => i.label.status !== "contestée");
  const conf = (set, mode) => { const inv = set.filter((i) => i.label.inv), clean = set.filter((i) => !i.label.inv); const tp = inv.filter((i) => flagged(outs[i.id], mode)).length, fp = clean.filter((i) => flagged(outs[i.id], mode)).length; return { n: set.length, inventions: inv.length, propres: clean.length, TP: tp, FN: inv.length - tp, FP: fp, TN: clean.length - fp, rappel: pct(tp, inv.length), fauxPositifs: pct(fp, clean.length), precision: pct(tp, tp + fp) }; };
  const strong = measurable.filter((i) => i.label.status === "double");
  // pertinence du passage : parmi les inventions signalées pour lesquelles un relecteur a cité un passage
  const arbFp = (i) => (labels === "arbitrated" ? ARB.arbitrage_faux_positifs_dev.find((x) => x.id === i.id) : null);
  const passageOk = (i) => { const a = arbFp(i); if (a) { const sg = a.signalements.filter((x) => x.model === model); if (sg.length) return sg.some((x) => x.verifier_a_raison); } if (labels === "arbitrated" && PASSAGE_EXC[i.id]?.[model] !== undefined) return PASSAGE_EXC[i.id][model]; return anomaliesOf(outs[i.id].parsed).some((c) => i.readerQuotes.some((q) => overlap(q, c.quote) >= 0.5)); };
  const evaluable = (i) => i.readerQuotes.length || arbFp(i) || (labels === "arbitrated" && PASSAGE_EXC[i.id]);
  const hits = measurable.filter((i) => i.label.inv && flagged(outs[i.id], "bloquante") && evaluable(i)).map(passageOk);
  const invs = measurable.filter((i) => i.label.inv), detected = invs.filter((i) => flagged(outs[i.id], "bloquante")), usefulEval = detected.filter(evaluable);
  const detectionUtile = { inventions: invs.length, detectees: detected.length, detecteesAvecPassageEvaluable: usefulEval.length, avecBonPassage: usefulEval.filter(passageOk).length };
  const o = have.map((i) => outs[i.id]);
  const byVersion = Object.fromEntries(VERSIONS.map((v) => { const s = measurable.filter((i) => i.version === v); return [v, s.length ? conf(s, "bloquante") : null]; }));
  const byBrief = Object.fromEntries(SPLITS[split].map((b) => { const s = measurable.filter((i) => i.briefId === b); return [b.replace("explo-", ""), s.length ? conf(s, "bloquante") : null]; }));
  // référence : l'auto-audit de B2b sur les mêmes textes
  const b2bAudit = (() => { const r = fs.readFileSync(path.join(DIR, "results.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse).filter((x) => x.version === "B2b" && !x.failed && x.audit); const byId = Object.fromEntries(r.map((x) => [bid(x.runId), x])); const s = measurable.filter((i) => i.version === "B2b" && byId[i.id]); const inv = s.filter((i) => i.label.inv), cl = s.filter((i) => !i.label.inv), f = (i) => byId[i.id].audit.unsupported.length > 0; return { n: s.length, rappel: pct(inv.filter(f).length, inv.length), fauxPositifs: pct(cl.filter(f).length, cl.length) }; })();
  return {
    etiquettes: labels, model: MODELS[model].id, split, promptVersion: VERIFIER_PROMPT_VERSION, detectionUtile, textes: have.length, contestees: have.length - measurable.length,
    principal: conf(measurable, "bloquante"), toutesGravites: conf(measurable, "toute"), etiquettesDoubles: strong.length ? conf(strong, "bloquante") : null,
    pertinencePassage: { evaluables: hits.length, pertinents: hits.filter(Boolean).length, taux: pct(hits.filter(Boolean).length, hits.length) },
    jsonInvalide: pct(o.filter((x) => !x.valid).length, o.length), relances: o.filter((x) => x.retried).length,
    latenceMs: { moyenne: Math.round(avg(o.map((x) => x.ms))), mediane: quantile(o.map((x) => x.ms), 0.5), p95: quantile(o.map((x) => x.ms), 0.95) },
    tokens: { entree: Math.round(avg(o.map((x) => x.inputTokens))), sortie: Math.round(avg(o.map((x) => x.outputTokens))) }, coutMoyenUsd: +avg(o.map((x) => x.costUsd)).toFixed(4),
    anomaliesParTexte: +avg(o.map((x) => anomaliesOf(x.parsed).length)).toFixed(2), reference_autoAuditB2b: b2bAudit, parVersion: byVersion, parBrief: byBrief,
  };
}
function score() { const model = flag("model"), split = flag("split"); if (!MODELS[model] || !SPLITS[split]) fail("score --model sonnet|haiku --split dev|val [--labels arbitrated]"); const r = scoreOne(model, split, flag("labels", "original")); if (!r) fail("Aucune sortie."); console.log(JSON.stringify(r, null, 1)); }

// ── report ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function verdict(val, dev) {
  const p = val.principal, ok = [], ko = [];
  const t = (cond, label) => (cond ? ok : ko).push(label);
  t(p.rappel >= THRESHOLDS.recall * 100, `rappel ${p.rappel} % (seuil ${THRESHOLDS.recall * 100})`);
  t(p.fauxPositifs <= THRESHOLDS.fpr * 100, `faux positifs ${p.fauxPositifs} % (seuil ${THRESHOLDS.fpr * 100})`);
  t((val.pertinencePassage.taux ?? 0) >= THRESHOLDS.passage * 100, `pertinence du passage ${val.pertinencePassage.taux} % (seuil ${THRESHOLDS.passage * 100})`);
  t(val.jsonInvalide <= THRESHOLDS.invalid * 100, `JSON invalide ${val.jsonInvalide} % (seuil ${THRESHOLDS.invalid * 100})`);
  t(val.latenceMs.mediane <= THRESHOLDS.medianMs, `latence médiane ${(val.latenceMs.mediane / 1000).toFixed(1)} s (seuil ${THRESHOLDS.medianMs / 1000})`);
  t(val.coutMoyenUsd <= THRESHOLDS.costUsd, `coût ${val.coutMoyenUsd} $ (seuil ${THRESHOLDS.costUsd})`);
  const gap = dev ? Math.abs(dev.principal.rappel - p.rappel) : null; if (gap !== null) t(gap <= THRESHOLDS.gap * 100, `écart de rappel dev/val ${gap.toFixed(1)} points (seuil ${THRESHOLDS.gap * 100})`);
  const strict = ko.length === 0;
  const reserve = p.rappel >= THRESHOLDS.recallReserve * 100 && p.rappel < THRESHOLDS.recall * 100 || p.fauxPositifs > THRESHOLDS.fpr * 100 && p.fauxPositifs <= THRESHOLDS.fprReserve * 100;
  return { decision: strict ? "EXPLOITABLE" : (p.rappel >= THRESHOLDS.recallReserve * 100 && p.fauxPositifs <= THRESHOLDS.fprReserve * 100 ? "EXPLOITABLE AVEC RÉSERVES" : "INSUFFISANT"), atteints: ok, manques: ko, reserve };
}
function report() {
  let md = `# Rapport du banc d'essai du vérificateur indépendant\n\nGénéré par \`scripts/eval-verifier.mjs report\` à partir des sorties enregistrées (prompt ${VERIFIER_PROMPT_VERSION}, empreinte ${verifierPromptHash()}). Protocole et seuils : \`verifier-protocole.md\`.\n\n`;
  for (const model of ["sonnet", "haiku"]) {
    const dev = scoreOne(model, "dev"), val = scoreOne(model, "val"); if (!val) continue;
    const v = verdict(val, dev);
    md += `## ${MODELS[model].id}\n\n**Décision selon les seuils annoncés : ${v.decision}**\n\n- Seuils atteints : ${v.atteints.join(" ; ") || "aucun"}\n- Seuils manqués : ${v.manques.join(" ; ") || "aucun"}\n\n`;
    md += `| | Développement | **Validation** |\n|---|---:|---:|\n`;
    const row = (l, f) => `| ${l} | ${dev ? f(dev) : "—"} | ${f(val)} |\n`;
    md += row("Textes mesurables / contestés écartés", (x) => `${x.principal.n} / ${x.contestees}`) + row("Inventions / propres", (x) => `${x.principal.inventions} / ${x.principal.propres}`) + row("Rappel (anomalie bloquante)", (x) => `${x.principal.rappel} %`) + row("Faux positifs", (x) => `${x.principal.fauxPositifs} %`) + row("Précision", (x) => `${x.principal.precision} %`) + row("Rappel, toutes gravités", (x) => `${x.toutesGravites.rappel} % (faux positifs ${x.toutesGravites.fauxPositifs} %)`) + row("Rappel, étiquettes doubles seulement", (x) => (x.etiquettesDoubles ? `${x.etiquettesDoubles.rappel} % (n=${x.etiquettesDoubles.inventions} inventions)` : "—")) + row("Pertinence du passage", (x) => `${x.pertinencePassage.taux} % (${x.pertinencePassage.pertinents}/${x.pertinencePassage.evaluables})`) + row("JSON invalide / relances", (x) => `${x.jsonInvalide} % / ${x.relances}`) + row("Latence médiane (p95)", (x) => `${(x.latenceMs.mediane / 1000).toFixed(1)} s (${(x.latenceMs.p95 / 1000).toFixed(1)} s)`) + row("Tokens entrée / sortie", (x) => `${x.tokens.entree} / ${x.tokens.sortie}`) + row("Coût moyen estimé", (x) => `${x.coutMoyenUsd} $`) + row("Référence : auto-audit B2b (rappel / faux positifs)", (x) => `${x.reference_autoAuditB2b.rappel} % / ${x.reference_autoAuditB2b.fauxPositifs} % (n=${x.reference_autoAuditB2b.n})`);
    md += `\nPar version de moteur (validation) : ${VERSIONS.map((vv) => { const c = val.parVersion[vv]; return c ? `${vv} rappel ${c.rappel ?? "—"} % / FP ${c.fauxPositifs ?? "—"} % (${c.inventions}+${c.propres})` : null; }).filter(Boolean).join(" ; ")}\n\nPar brief (validation) : ${Object.entries(val.parBrief).map(([b, c]) => c ? `${b} rappel ${c.rappel ?? "—"} % / FP ${c.fauxPositifs ?? "—"} % (${c.inventions}+${c.propres})` : null).filter(Boolean).join(" ; ")}\n\n`;
  }
  fs.writeFileSync(path.join(process.cwd(), "docs", "eval-editorial", "verifier-rapport-chiffres.md"), md);
  console.log(md);
}

// ── sample et contestées ──────────────────────────────────────────────────────────────────────────────────────────────────
function seeded(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function sample() {
  const model = flag("model", "sonnet"); const items = readJson(path.join(VDIR, "dataset.json"), []).filter((i) => i.split === "val" && i.label.status !== "contestée"); const outs = loadOutputs(model);
  const rnd = seeded(20261102); const shuffle = (a) => [...a].sort(() => rnd() - 0.5); const have = items.filter((i) => outs[i.id]);
  const pick = [...shuffle(have.filter((i) => i.label.inv && flagged(outs[i.id], "bloquante"))).slice(0, 8), ...shuffle(have.filter((i) => !i.label.inv && flagged(outs[i.id], "bloquante"))).slice(0, 4), ...shuffle(have.filter((i) => i.label.inv && !flagged(outs[i.id], "bloquante"))).slice(0, 6), ...shuffle(have.filter((i) => !i.label.inv && !flagged(outs[i.id], "bloquante"))).slice(0, 6)];
  const order = shuffle(pick);
  let md = `# Échantillon à noter à la main — vérificateur ${MODELS[model].id}\n\nPour chaque texte : (1) les anomalies signalées sont-elles de vraies affirmations non étayées (oui / non / partiellement) ? (2) la justification est-elle exacte et utile (0 à 2) ? (3) y a-t-il une invention que le vérificateur n'a pas signalée ? La clé des étiquettes des relecteurs est à la fin du document.\n`;
  order.forEach((it, k) => { const a = anomaliesOf(outs[it.id].parsed); md += `\n---\n\n## ${k + 1}. ${it.id}\n\n**Brief** : ${it.briefText}\n\n**Post** :\n\n${it.postText}\n\n**Anomalies signalées** : ${a.length ? "" : "aucune"}\n${a.map((c) => `- [${c.category} · ${c.gravite}] « ${c.quote} » — ${c.problem} (${c.justification})`).join("\n")}\n`; });
  md += `\n---\n\n## Clé (à ouvrir après la notation)\n\n${order.map((it, k) => `${k + 1}. ${it.id} · version ${it.version} · ${it.briefId.replace("explo-", "")}/${it.profile} · étiquette des relecteurs : ${it.label.inv ? "invention" : "propre"} (${it.label.status}) · signalé : ${flagged(outs[it.id], "bloquante") ? "oui" : "non"}`).join("\n")}\n`;
  fs.writeFileSync(path.join(DIR, "verifier", `echantillon-humain-${model}.md`), md); console.log(`✓ data/eval-editorial/verifier/echantillon-humain-${model}.md (${order.length} textes)`);
}
function contestees() {
  const items = readJson(path.join(VDIR, "dataset.json"), []).filter((i) => i.label.status === "contestée"); const o = { sonnet: loadOutputs("sonnet"), haiku: loadOutputs("haiku") };
  let md = `# Étiquettes contestées : arbitrage humain\n\nCes textes sont **exclus de toutes les métriques**. Pour chacun : les lectures qui divergent et le verdict de chaque vérificateur. Décision à prendre : invention significative, oui ou non.\n`;
  for (const it of items) { md += `\n---\n\n## ${it.id} · version ${it.version} · ${it.briefId.replace("explo-", "")}/${it.profile}\n\n**Brief** : ${it.briefText}\n\n**Post** :\n\n${it.postText}\n\n**Lectures** :\n${it.label.readings.map((r) => `- ${r.source} : ${r.inv ? "invention" : "pas d'invention"} — ${r.note}`).join("\n")}\n\n**Vérificateurs** :\n`; for (const m of ["sonnet", "haiku"]) { const out = o[m][it.id]; md += out ? `- ${m} : ${anomaliesOf(out.parsed).length ? anomaliesOf(out.parsed).map((c) => `[${c.gravite}] « ${c.quote} » — ${c.problem}`).join(" | ") : "aucune anomalie"}\n` : `- ${m} : non exécuté\n`; } md += `\n**Votre arbitrage** : ☐ invention ☐ pas d'invention\n`; }
  fs.writeFileSync(path.join(DIR, "verifier", "contestees-arbitrage.md"), md); console.log(`✓ data/eval-editorial/verifier/contestees-arbitrage.md (${items.length} textes)`);
}

// Faux positifs des deux vérificateurs : l'étiquette des relecteurs est-elle fiable, ou le vérificateur a-t-il raison ? (arbitrage humain)
function arbitrage() {
  const split = flag("split", "dev"); const items = readJson(path.join(VDIR, "dataset.json"), []).filter((i) => i.split === split && i.label.status !== "contestée" && !i.label.inv);
  const o = { sonnet: loadOutputs("sonnet"), haiku: loadOutputs("haiku") };
  const fp = items.filter((i) => ["sonnet", "haiku"].some((m) => o[m][i.id] && flagged(o[m][i.id], "bloquante")));
  let md = `# Arbitrage des « faux positifs » (${split}, prompt ${VERIFIER_PROMPT_VERSION})\n\nCes ${fp.length} textes ont été étiquetés **sans invention significative** par les relecteurs, mais au moins un vérificateur y a signalé une affirmation de gravité bloquante. Pour chaque passage signalé : **le vérificateur a-t-il raison ?** (☐ oui : vraie affirmation factuelle non étayée et significative · ☐ non : conviction, pratique habituelle du profil ou détail sans incidence). Si les relecteurs ont laissé passer de vraies inventions, la mesure de faux positifs est surestimée.\n`;
  fp.forEach((it, k) => { md += `\n---\n\n## ${k + 1}. ${it.id} · version ${it.version} · ${it.briefId.replace("explo-", "")}/${it.profile}\n\n**Brief** : ${it.briefText}\n\n**Post** :\n\n${it.postText}\n\n**Lecture des relecteurs** : ${it.label.readings[0].note}\n\n`; for (const m of ["sonnet", "haiku"]) { const a = o[m][it.id] ? anomaliesOf(o[m][it.id].parsed).filter((c) => c.gravite === "bloquante") : []; md += `**${m}** : ${a.length ? "" : "aucune anomalie bloquante"}\n${a.map((c) => `- « ${c.quote} » — ${c.problem} (${c.justification}) — ☐ le vérificateur a raison ☐ a tort`).join("\n")}\n`; } });
  fs.writeFileSync(path.join(VDIR, `arbitrage-faux-positifs-${split}.md`), md); console.log(`✓ data/eval-editorial/verifier/arbitrage-faux-positifs-${split}.md (${fp.length} textes)`);
}

const COMMANDS = { prepare, run, score, report, sample, contestees, arbitrage };
if (!COMMANDS[cmd]) fail("Commande : prepare | run | score | report | sample | contestees");
await COMMANDS[cmd]();
