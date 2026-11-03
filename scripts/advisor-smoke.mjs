#!/usr/bin/env node
// Essai de bout en bout du conseiller éditorial contre un serveur lancé avec EDITORIAL_ADVISOR=1 (voir docs/eval-editorial/conseiller-v1.md).
// Utilise des briefs et des textes DÉJÀ générés du jeu exploratoire ; ne génère aucune publication. Ce n'est pas un benchmark.
//   node scripts/advisor-smoke.mjs [--base http://localhost:3104]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const base = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3104").replace(/\/$/, "");
const DIR = path.join(process.cwd(), "data", "eval-editorial");
const accounts = JSON.parse(fs.readFileSync(path.join(DIR, "accounts.json"), "utf8"));
const briefs = Object.fromEntries(JSON.parse(fs.readFileSync("docs/eval-editorial/briefs.json", "utf8")).explo.map((b) => [b.id, b.brief]));
const results = fs.readFileSync(path.join(DIR, "results.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse).filter((r) => !r.failed);
const bid = (id) => "T" + crypto.createHash("sha256").update("eval-" + id).digest("hex").slice(0, 5).toUpperCase();
const textOf = (id) => results.find((r) => bid(r.runId) === id)?.text.trim();
const PRICE = { sonnet: [3, 15], haiku: [1, 5] };

async function login(pid) {
  const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: accounts[pid].email, password: accounts[pid].password }) });
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie) throw new Error(`connexion impossible (${r.status})`);
  return cookie;
}
const call = async (cookie, route, body) => { const t0 = Date.now(); const r = await fetch(`${base}/api/advisor/${route}`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); return { status: r.status, ms: Date.now() - t0, d }; };
const rows = []; const check = (name, ok, detail = "") => { rows.push({ name, ok }); console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`); };

const cookie = await login("wharf");
const aster = await login("aster");

console.log("── Analyse du brief ──");
const BRIEF_CASES = [
  ["explo-industrie", "ready", "brief complet (tolérance)"], ["explo-rh", "ready", "brief complet (journée d'intégration)"], ["explo-transformation", "ready", "brief complet (outil déployé)"],
  ["explo-reglementaire", "ready", "brief complet (règlement)"], ["explo-incomplet", "needs_clarification", "brief incomplet (prix)"], ["explo-contradictoire", "blocked", "brief contradictoire (−20 %)"],
];
for (const [id, expected, label] of BRIEF_CASES) {
  const r = await call(cookie, "brief", { theme: briefs[id], expertise: "Agence de communication corporate B2B" });
  check(`brief · ${label} → ${expected}`, r.status === 200 && r.d.status === expected, `obtenu ${r.d.status} en ${(r.ms / 1000).toFixed(1)} s${r.d.issues?.length ? " · « " + r.d.issues[0].question + " »" : ""}`);
}
const thematic = await call(cookie, "brief", { theme: "Pourquoi la qualité industrielle se joue avant la production, pas à la réception des pièces" });
check("brief · sujet thématique : aucun appel IA (analysed=false)", thematic.d.status === "ready" && thematic.d.analysed === false);
const opinion = await call(cookie, "brief", { theme: "Les entreprises qui communiquent sur leurs résultats ne sont pas celles qui en ont le plus, mais celles qui savent les raconter. Je défends cette idée depuis dix ans." });
check("brief · conviction / opposition d'idées : pas de contradiction", opinion.status === 200 && opinion.d.status !== "blocked", `statut ${opinion.d.status}`);

console.log("── Vérification ──");
const cost = [];
const VER_CASES = [
  ["TA7DF0", "explo-industrie", "aster", "texte avec origine et rôle inventés", (d) => d.alerts.some((a) => a.category === "unsupported")],
  ["T6F14D", "explo-incomplet", "wharf", "texte attribuant un contenu au prix", (d) => d.alerts.length >= 1],
  ["T3F7B3", "explo-rh", "wharf", "texte de conviction de marque (jugé propre)", (d) => !d.alerts.some((a) => a.category === "unsupported" && /verif|garanti/i.test(a.title))],
];
for (const [tid, bid_, pid, label, ok] of VER_CASES) {
  const text = textOf(tid); if (!text) { check(`vérification · ${label} : texte introuvable`, false); continue; }
  const r = await call(pid === "aster" ? aster : cookie, "verify", { text, brief: briefs[bid_] });
  const m = r.d.meta;
  if (m) cost.push({ ms: r.ms, usd: (m.inputTokens / 1e6) * PRICE.sonnet[0] + (m.outputTokens / 1e6) * PRICE.sonnet[1], inTok: m.inputTokens, outTok: m.outputTokens });
  check(`vérification · ${label}`, r.status === 200 && ok(r.d), `${r.d.alerts?.length ?? "?"} alerte(s) en ${(r.ms / 1000).toFixed(1)} s${r.d.alerts?.[0] ? " · « " + r.d.alerts[0].quote.slice(0, 70) + " » (" + r.d.alerts[0].category + ", passage retrouvé : " + r.d.alerts[0].found + ")" : ""}`);
  if (tid === "TA7DF0") check("vérification · alerte avec passage exact, motif et action", r.d.alerts?.[0] && r.d.alerts[0].found && r.d.alerts[0].problem && r.d.alerts[0].action && !("blocked" in r.d.alerts[0]));
}
// avec précisions de l'auteur : le brief enrichi est transmis
const enriched = await call(cookie, "verify", { text: textOf("T6F14D"), brief: `${briefs["explo-incomplet"]}\n\nPrécisions de l'auteur :\n- Quel est le nom du prix ? → Trophée Sécurité de la CCI, pour notre protocole de sécurité en atelier` });
check("vérification · avec précisions du brief", enriched.status === 200, `${enriched.d.alerts?.length} alerte(s)`);
if (enriched.d.meta) cost.push({ ms: enriched.ms, usd: (enriched.d.meta.inputTokens / 1e6) * 3 + (enriched.d.meta.outputTokens / 1e6) * 15, inTok: enriched.d.meta.inputTokens, outTok: enriched.d.meta.outputTokens });

console.log("── Reformulation prudente ──");
const t = textOf("TA7DF0"); const v = await call(aster, "verify", { text: t, brief: briefs["explo-industrie"] });
if (v.d.alerts?.[0]) {
  const rw = await call(aster, "rewrite", { text: t, quote: v.d.alerts[0].quote, problem: v.d.alerts[0].problem });
  check("reformulation · proposition renvoyée, texte non modifié côté serveur", rw.status === 200 && typeof rw.d.replacement === "string" && rw.d.replacement !== v.d.alerts[0].quote, `« ${String(rw.d.replacement).slice(0, 110)} » en ${(rw.ms / 1000).toFixed(1)} s`);
}

console.log("── Garde-fous ──");
check("verify · texte vide → 400", (await call(cookie, "verify", { text: "", brief: "b" })).status === 400);
check("verify · sans brief → 400", (await call(cookie, "verify", { text: "Un texte.", brief: "" })).status === 400);
check("verify · texte trop long → 413", (await call(cookie, "verify", { text: "x".repeat(6500), brief: "b" })).status === 413);
check("verify · thématique d'un autre compte ou inexistante → 400", (await call(cookie, "verify", { text: "Un texte.", brief: "b", contextId: "inconnu" })).status === 400);
check("rewrite · passage absent du texte → 409", (await call(cookie, "rewrite", { text: "Un texte.", quote: "autre chose" })).status === 409);
const anon = await fetch(`${base}/api/advisor/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "x", brief: "y" }) });
check("verify · sans session → 401", anon.status === 401);

const sum = (a, k) => a.reduce((t, x) => t + x[k], 0);
if (cost.length) console.log(`\nVérification (Sonnet) · ${cost.length} appels · latence moyenne ${(sum(cost, "ms") / cost.length / 1000).toFixed(1)} s · tokens ${Math.round(sum(cost, "inTok") / cost.length)} / ${Math.round(sum(cost, "outTok") / cost.length)} · coût moyen ${(sum(cost, "usd") / cost.length).toFixed(4)} $`);
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} contrôles réussis`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);
