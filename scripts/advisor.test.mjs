// Tests du conseiller éditorial V1. Lancer : node --test scripts/advisor.test.mjs
// Les routes (alias « @/ ») sont vérifiées par lecture du code ; toute la logique de décision est testée directement.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { campaignFacts, campaignItemBrief, CAMPAIGN_FACTS_MAX, ITEM_BRIEF_MAX } from "../lib/advisorCampaign.js";
import { advisorEnabled, decideAdvisorAccess, ADVISOR_MODES } from "../lib/advisorFlag.js";
import { needsBriefAnalysis, parseBriefAnalysis, deriveBriefStatus, appendClarifications, briefUserPrompt, BRIEF_SYSTEM, MAX_QUESTIONS, MAX_BRIEF_CHARS } from "../lib/advisorBrief.js";
import { hashText, locatePassage, idleReview, startReview, failReview, applyVerification, decide, syncWithText, openCount, reviewLabel, loadReview, saveReview, buildSegments, removePassage } from "../lib/advisorReview.js";
import { buildVerifyPrompt, mapVerifierToAlerts, MAX_ALERTS } from "../lib/advisorVerify.js";
import { cleanReplacement, applyReplacement, rewriteUserPrompt, rewriteAllUserPrompt, cleanReplacements, applyReplacements, MAX_BATCH } from "../lib/advisorRewrite.js";
import { AdvisorError, errorBody, callClaude } from "../lib/advisorLlm.js";
import { verifierPromptHash, parseVerifierOutput } from "../lib/verifierPrompt.mjs";
import { writingRulesPrompt } from "../lib/linkedinRules.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const h = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const TEXT = "Nous avons réduit nos délais de 20 %.\n\nChez nous, la rigueur commence en amont.\n\nUn client nous a dit que le gain était immédiat.";
const claims = (list) => ({ claims: list.map((c) => ({ quote: "", category: "non_etayee", gravite: "bloquante", problem: "p", justification: "j", ...c })) });

// ── 1. Brief complet : génération normale avec A ───────────────────────────────────────────────────────────────────────────
test("scénario 1 : un sujet thématique n'appelle aucune analyse ; sans problème le statut est « ready »", () => {
  assert.equal(needsBriefAnalysis("Pourquoi la qualité se joue avant la production"), false);
  assert.equal(needsBriefAnalysis("court"), false);
  assert.equal(deriveBriefStatus([]), "ready");
  assert.deepEqual(parseBriefAnalysis('{"issues":[]}'), { issues: [], status: "ready" });
});
test("scénario 1 : le moteur A et son contrat ne sont pas touchés (aucune importation du conseiller dans /api/generate)", () => {
  const src = read("app/api/generate/route.js");
  assert.ok(!/from "@\/lib\/advisor|EditorialAdvisor|\/api\/advisor/.test(src), "la route de génération n'importe rien du conseiller éditorial");
  assert.equal(h(writingRulesPrompt(1300)), "e99f7b0ce00264fb", "prompt de A inchangé");
  assert.equal(h(writingRulesPrompt(2200)), "d2eac1ba7143e445");
  assert.ok(src.includes('text: result.text, extra:') && src.includes("why: cleanWhy(result.why, result.text), sources: usedSources("), "contrat text/extra/why/sources");
});

// ── 2. Brief incomplet : question pertinente, sans blocage systématique ────────────────────────────────────────────────────
test("scénario 2 : une information essentielle manquante → needs_clarification (jamais blocked), 3 questions au plus", () => {
  const raw = JSON.stringify({ issues: [1, 2, 3, 4, 5].map((i) => ({ kind: "missing", question: `Question ${i} ?`, why: "w", quotes: ["Nous avons reçu un prix"] })) });
  const r = parseBriefAnalysis(raw);
  assert.equal(r.status, "needs_clarification");
  assert.equal(r.issues.length, MAX_QUESTIONS);
  assert.equal(r.issues[0].quotes[0], "Nous avons reçu un prix");
});
test("scénario 2 : le prompt interdit les questions secondaires et les sujets de réflexion sans manque", () => {
  const p = briefUserPrompt("Nous avons reçu un prix pour notre démarche de sécurité.", "PME");
  assert.ok(p.includes("ne pose pas de question secondaire"));
  assert.ok(p.includes("Un sujet de réflexion, d'opinion ou de conseil sans événement à raconter n'a aucun manque"));
  assert.ok(needsBriefAnalysis("Nous avons reçu un prix pour notre démarche de sécurité."));
});

// ── 3. Brief contradictoire : clarification demandée, pas de conciliation inventée ──────────────────────────────────────────
test("scénario 3 : une contradiction factuelle → blocked, classée avant les manques ; l'opposition d'idées n'en est pas une", () => {
  const r = parseBriefAnalysis(JSON.stringify({ issues: [{ kind: "missing", question: "Quel indicateur ?", why: "w", quotes: [] }, { kind: "contradiction", question: "Quelle mesure est exacte : −20 % ou aucune évolution ?", why: "w", quotes: ["Nos délais ont baissé de 20 %", "n'ont pas changé"] }] }));
  assert.equal(r.status, "blocked");
  assert.equal(r.issues[0].kind, "contradiction");
  const p = briefUserPrompt("x", "y");
  assert.ok(p.includes("Une opposition d'idées, une conviction, un point de vue critique ou un constat nuancé n'est PAS une contradiction"));
  assert.ok(BRIEF_SYSTEM.includes("uniquement ce qui empêcherait de l'écrire honnêtement"));
  assert.ok(needsBriefAnalysis("Nos délais ont baissé de 20 % ce trimestre. Le directeur logistique indique pourtant qu'ils n'ont pas évolué."));
});
test("scénario 3 : la réponse de l'auteur est ajoutée au brief, dans la limite de la génération, sans perdre la précision", () => {
  const t = appendClarifications("x".repeat(1500), [{ question: "Quelle mesure est exacte ?", answer: "Le tableau de bord : −20 % depuis janvier" }]);
  assert.ok(t.length <= MAX_BRIEF_CHARS);
  assert.ok(t.includes("Précisions de l'auteur") && t.includes("−20 % depuis janvier"));
  assert.equal(appendClarifications("brief", [{ question: "q", answer: "  " }]), "brief");
});

// ── 4-6. Vérification : résultat inventé, conviction, passage exact ────────────────────────────────────────────────────────
test("scénario 4 : un résultat inventé produit une alerte « ajout du rédacteur »", () => {
  const { alerts } = mapVerifierToAlerts({ parsed: claims([{ quote: "Un client nous a dit que le gain était immédiat.", problem: "Citation et résultat non fournis." }]), text: TEXT, profile: {} });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].category, "unsupported");
  assert.equal(alerts[0].title, "Ajout du rédacteur");
});
test("scénario 5 : une conviction n'est jamais une alerte ; une pratique décrite dans le profil est seulement « à confirmer »", () => {
  const { alerts, interpretations } = mapVerifierToAlerts({ parsed: claims([{ quote: "Chez nous, la rigueur commence en amont.", category: "interpretation", gravite: "mineure" }]), text: TEXT, profile: {} });
  assert.equal(alerts.length, 0);
  assert.deepEqual(interpretations, ["Chez nous, la rigueur commence en amont."]);
  const profile = { editorialLine: "La rigueur commence en amont, dès la conception, pas à la réception des pièces." };
  const m = mapVerifierToAlerts({ parsed: claims([{ quote: "Chez nous, la rigueur commence en amont.", category: "non_etayee", gravite: "bloquante" }]), text: TEXT, profile });
  assert.equal(m.alerts[0].category, "to_confirm", "pratique documentée dans le profil : pas traitée comme un fait inventé");
  assert.ok(m.alerts[0].justification.startsWith("Pratique ou conviction proche"));
});
test("scénario 5 : les remarques mineures sont écartées ; aucun champ de blocage n'existe dans une alerte", () => {
  const { alerts } = mapVerifierToAlerts({ parsed: claims([{ quote: "Un client nous a dit que le gain était immédiat.", gravite: "mineure" }]), text: TEXT, profile: {} });
  assert.equal(alerts.length, 0);
  const a = mapVerifierToAlerts({ parsed: claims([{ quote: "Nous avons réduit nos délais de 20 %." }]), text: TEXT, profile: {} }).alerts[0];
  assert.ok(!Object.keys(a).some((k) => /block|bloq/i.test(k)));
});
test("scénario 6 : l'alerte porte le passage exact, le motif et l'action ; un passage mal recopié est retrouvé ; un passage introuvable devient « à confirmer »", () => {
  const a = mapVerifierToAlerts({ parsed: claims([{ quote: "nous avons réduit nos délais de 20 %", problem: "Résultat chiffré non fourni.", justification: "Le brief ne donne aucun chiffre." }]), text: TEXT, profile: {} }).alerts[0];
  assert.equal(a.found, true);
  assert.equal(a.problem, "Résultat chiffré non fourni.");
  assert.ok(a.justification && a.action);
  const loc = locatePassage(TEXT, "nous avons réduit nos délais de 20 %");
  assert.equal(TEXT.slice(loc.start, loc.end), "Nous avons réduit nos délais de 20 %");
  const lost = mapVerifierToAlerts({ parsed: claims([{ quote: "phrase qui n'existe pas" }]), text: TEXT, profile: {} }).alerts[0];
  assert.equal(lost.found, false);
  assert.equal(lost.category, "to_confirm");
});
test("alertes : plafond, doublons et passages inclus dans un autre écartés, graves d'abord", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ quote: `passage numéro ${i} du texte`, gravite: i % 2 ? "moderee" : "bloquante" }));
  const long = many.map((m) => m.quote).join(" ");
  const r = mapVerifierToAlerts({ parsed: claims(many.concat([{ quote: "passage numéro 3 du texte" }])), text: long, profile: {} });
  assert.ok(r.alerts.length <= MAX_ALERTS);
  assert.equal(new Set(r.alerts.map((a) => a.id)).size, r.alerts.length);
  const firstToConfirm = r.alerts.findIndex((a) => a.category === "to_confirm");
  assert.ok(firstToConfirm === -1 || r.alerts.slice(0, firstToConfirm).every((a) => a.category === "unsupported"));
});
test("vérificateur : reçoit brief, précisions, profil, sources et texte ; rien du rédacteur", () => {
  const { system, user } = buildVerifyPrompt({ brief: "Nous avons reçu un prix.\n\nPrécisions de l'auteur :\n- Quel prix ? → Prix Sécurité CCI", profile: { companyName: "ASTER", editorialLine: "Qualité en amont" }, sourcesBlock: "Source : règlement interne", text: "Notre post." });
  for (const mot of ["Prix Sécurité CCI", "ASTER", "Qualité en amont", "Source : règlement interne", "Notre post."]) assert.ok(user.includes(mot), mot);
  for (const interdit of ["advisory", "analysis", "audit", "missing", "classement", "why"]) assert.ok(!user.toLowerCase().includes(interdit), `ne doit pas contenir « ${interdit} »`);
  assert.ok(system.includes("indépendant") && system.includes("Tu n'as pas écrit ce texte"));
  assert.equal(verifierPromptHash(), "648bb5aa4a8b", "prompt v2 du protocole inchangé");
  assert.ok(!buildVerifyPrompt({ brief: "b", profile: {}, text: "t" }).user.includes("SOURCES DISPONIBLES"));
});

// ── 7-8. Décisions de l'utilisateur et caducité ────────────────────────────────────────────────────────────────────────────
const result = (quotes) => ({ alerts: quotes.map((q) => ({ id: `a${hashText(q.toLowerCase())}`, category: "unsupported", title: "Affirmation non étayée", quote: q, problem: "p", justification: "j", action: "a" })), interpretations: [], verifiedAt: 1 });
test("scénario 7 : confirmer conserve la décision, y compris après une nouvelle vérification et après réouverture", () => {
  const q = "Nous avons réduit nos délais de 20 %";
  const r0 = applyVerification(idleReview(), TEXT, result([q, "Un client nous a dit que le gain était immédiat"]));
  assert.equal(reviewLabel(r0).label, "Points à examiner");
  assert.equal(openCount(r0), 2);
  const r1 = decide(r0, r0.alerts[0].id, "confirmed");
  assert.equal(openCount(r1), 1);
  assert.equal(r1.alerts[0].decision, "confirmed");
  const again = applyVerification(r1, TEXT, result([q, "Un client nous a dit que le gain était immédiat"]));
  assert.equal(again.alerts[0].decision, "confirmed", "décision conservée par une nouvelle vérification");
  // persistance locale simulée
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveReview(storage, r1);
  const back = loadReview(storage, TEXT);
  assert.equal(back.alerts[0].decision, "confirmed");
  assert.equal(loadReview(storage, TEXT + "!"), null);
  const done = decide(decide(r1, r1.alerts[1].id, "ignored"), r1.alerts[0].id, "confirmed");
  assert.equal(reviewLabel(done).label, "Relecture terminée");
});
test("scénario 7 : la décision est conservée même si le vérificateur cite un passage plus court ou plus long ; jamais pour un passage sans rapport", () => {
  const long = "L'un mesurait le temps entre la commande et la validation fournisseur. L'autre, entre la commande et la livraison effective";
  const r0 = applyVerification(idleReview(), TEXT, result([long]));
  const confirmed = decide(r0, r0.alerts[0].id, "confirmed");
  const shorter = applyVerification(confirmed, TEXT, result(["L'un mesurait le temps entre la commande et la validation fournisseur."]));
  assert.equal(shorter.alerts[0].decision, "confirmed");
  const other = applyVerification(confirmed, TEXT, result(["Un client nous a dit que le gain était immédiat"]));
  assert.equal(other.alerts[0].decision, "open");
  const edited = decide(r0, r0.alerts[0].id, "edited");
  assert.equal(applyVerification(edited, TEXT, result([long])).alerts[0].decision, "open", "un passage modifié n'est pas reporté");
});
test("scénario 7 : « ignorer » est explicite et réversible", () => {
  const r = applyVerification(idleReview(), TEXT, result(["Nous avons réduit nos délais de 20 %"]));
  const ign = decide(r, r.alerts[0].id, "ignored");
  assert.equal(ign.alerts[0].decision, "ignored");
  assert.equal(decide(ign, ign.alerts[0].id, "open").alerts[0].decision, "open");
  assert.equal(decide(r, r.alerts[0].id, "nimporte").alerts[0].decision, "open", "décision inconnue refusée");
});
test("scénario 8 : si le texte change, la vérification précédente est caduque ; elle revient si l'on retrouve le même texte", () => {
  const r0 = applyVerification(idleReview(), TEXT, result(["Nous avons réduit nos délais de 20 %", "Un client nous a dit que le gain était immédiat"]));
  const changed = TEXT.replace("Nous avons réduit nos délais de 20 %.", "Nos délais ont évolué.");
  const stale = syncWithText(r0, changed);
  assert.equal(stale.status, "stale");
  assert.equal(reviewLabel(stale).code, "stale");
  assert.equal(stale.alerts[0].decision, "edited", "passage disparu : marqué modifié");
  assert.equal(stale.alerts[1].decision, "open", "passage inchangé : toujours à traiter");
  assert.equal(syncWithText(stale, TEXT).status, "done", "retour au texte vérifié : résultat de nouveau valable");
  assert.equal(syncWithText(r0, TEXT), r0, "texte identique : rien ne change");
});
test("états globaux : non vérifié, en cours, points à examiner, relecture terminée ; jamais de promesse de fiabilité", () => {
  assert.equal(reviewLabel(idleReview()).label, "Non vérifié");
  assert.equal(reviewLabel(startReview(idleReview())).label, "Vérification en cours");
  const none = applyVerification(idleReview(), TEXT, result([]));
  assert.equal(reviewLabel(none).label, "Relecture terminée");
  const src = read("components/EditorialAdvisor.js");
  assert.ok(!/100\s?%\s?fiable|fiabilité garantie|texte (est )?garanti|certifié conforme|vérifié et validé/i.test(src), "aucune promesse de fiabilité");
  assert.ok(src.includes("Cela ne garantit pas que le texte est exact") && src.includes("ce n'est pas une preuve"));
  assert.ok(src.includes("Aucune source indépendante n'a vérifié ce point"));
});

// ── 9. Erreur API : texte conservé, reprise possible ───────────────────────────────────────────────────────────────────────
test("scénario 9 : une erreur de vérification conserve les alertes et décisions, et laisse relancer", () => {
  const r0 = decide(applyVerification(idleReview(), TEXT, result(["Nous avons réduit nos délais de 20 %"])), `a${hashText("nous avons réduit nos délais de 20 %")}`, "confirmed");
  const failed = failReview(startReview(r0), "Le service est injoignable.");
  assert.equal(failed.status, "error");
  assert.equal(failed.alerts[0].decision, "confirmed");
  assert.equal(reviewLabel(failed).label, "Vérification impossible");
  const retry = applyVerification(failed, TEXT, result(["Nous avons réduit nos délais de 20 %"]));
  assert.equal(retry.alerts[0].decision, "confirmed");
});
test("scénario 9 : erreurs typées, messages clairs, texte jamais perdu", async () => {
  const { body, status } = errorBody(new AdvisorError("timeout", "La vérification a pris trop de temps. Votre texte est conservé : vous pouvez réessayer.", 504));
  assert.equal(status, 504); assert.equal(body.code, "timeout");
  assert.equal(errorBody(new Error("secret interne")).body.error.includes("secret"), false);
  const realFetch = globalThis.fetch; process.env.ANTHROPIC_API_KEY = "test";
  try {
    globalThis.fetch = async () => new Response("{}", { status: 503 });
    await assert.rejects(callClaude({ model: "m", system: "s", user: "u" }), (e) => e.code === "ai_off" && e.status === 503);
    globalThis.fetch = async () => new Response("{}", { status: 500 });
    await assert.rejects(callClaude({ model: "m", system: "s", user: "u" }), (e) => e.code === "provider" && /conserv/.test(e.message));
    globalThis.fetch = async (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" }))));
    await assert.rejects(callClaude({ model: "m", system: "s", user: "u", timeoutMs: 20 }), (e) => e.code === "timeout" && e.status === 504);
    globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ text: "ok" }], usage: { input_tokens: 5, output_tokens: 2 } }), { status: 200 });
    const ok = await callClaude({ model: "m", system: "s", user: "u" });
    assert.deepEqual([ok.text, ok.inputTokens, ok.outputTokens], ["ok", 5, 2]);
  } finally { globalThis.fetch = realFetch; }
});

// ── 10. Feature flag désactivé : comportement existant inchangé ────────────────────────────────────────────────────────────
test("scénario 10 : désactivé par défaut ; routes en 404 ; interface sans effet", () => {
  assert.equal(advisorEnabled({}), false);
  assert.equal(advisorEnabled({ EDITORIAL_ADVISOR: "0" }), false);
  assert.equal(advisorEnabled({ EDITORIAL_ADVISOR: "1" }), true);
  const pre = read("lib/advisorRoute.js");
  assert.ok(pre.indexOf("advisorEnabled()") < pre.indexOf("getEffectiveUserId(req)"), "l'interrupteur est testé avant toute autre chose");
  for (const r of ["brief", "verify", "rewrite", "rewrite-all"]) assert.ok(read(`app/api/advisor/${r}/route.js`).includes("advisorPreflight("), `${r} passe par le préambule`);
  const page = read("app/app/page.js");
  assert.ok(page.includes("if (advisorOn && genMode === \"single\" && !opts?.skipBriefCheck)"), "analyse du brief derrière le drapeau");
  assert.ok(page.includes("{advisorOn && result?.text && ("), "carte de relecture derrière le drapeau");
  assert.ok(page.includes("{advisorOn && briefCheck?.analysis && !result && ("), "carte de questions derrière le drapeau");
});

// ── Sécurité et confidentialité ────────────────────────────────────────────────────────────────────────────────────────────
test("sécurité : authentification, accès, limite de débit et taille sur chaque route ; aucun texte d'utilisateur dans les logs", () => {
  const pre = read("lib/advisorRoute.js");
  for (const k of ["getEffectiveUserId", "checkAccess", "rateLimit(", "content-length", "getContextFor"]) assert.ok(pre.includes(k), k);
  for (const f of ["lib/advisorRoute.js", "lib/advisorLlm.js", "app/api/advisor/brief/route.js", "app/api/advisor/verify/route.js", "app/api/advisor/rewrite/route.js", "app/api/advisor/rewrite-all/route.js"]) {
    const src = read(f);
    assert.ok(!/console\.log/.test(src), `${f} : pas de console.log`);
    for (const line of src.split("\n").filter((l) => /console\.(error|warn)/.test(l))) assert.ok(/e\?\.code/.test(line) && !/text|brief|quote/.test(line.replace(/\[conseiller\][^"]*"/, "")), `${f} : log limité au type d'erreur`);
  }
  assert.ok(read("app/api/advisor/verify/route.js").includes("authorContext(pre.userId"), "profil et sources du seul compte connecté");
});
test("verifierPrompt v2 : la sortie du vérificateur est analysée de façon stricte", () => {
  assert.equal(parseVerifierOutput("pas de json"), null);
  assert.equal(parseVerifierOutput('{"claims":"x"}'), null);
  assert.equal(parseVerifierOutput('{"claims":[{"quote":"a","category":"inconnue"}]}').claims.length, 0);
});
test("reformulation : proposition nettoyée et appliquée seulement si le passage est présent", () => {
  assert.equal(cleanReplacement('{"replacement":"Nous pensons que nos délais ont pu baisser."}', "Nous avons réduit nos délais de 20 %."), "Nous pensons que nos délais ont pu baisser.");
  assert.equal(cleanReplacement('{"replacement":""}', "x"), null);
  assert.equal(cleanReplacement("pas de json", "x"), null);
  assert.equal(cleanReplacement(`{"replacement":"${"a".repeat(900)}"}`, "court"), null);
  assert.equal(applyReplacement(TEXT, "Nous avons réduit nos délais de 20 %.", "Nos délais ont pu baisser."), TEXT.replace("Nous avons réduit nos délais de 20 %.", "Nos délais ont pu baisser."));
  assert.equal(applyReplacement(TEXT, "passage disparu", "x"), null);
});

// ── Lecture par origine et reformulation groupée ───────────────────────────────────────────────────────────────────────────
const POST = "Le brief annonce un prix de sécurité. Chez nous, la rigueur commence en amont. Ce protocole a réduit nos écarts de moitié depuis deux ans.";
test("origine : le texte est lu en faits établis, convictions et ajouts à valider (les ajouts l'emportent en cas de chevauchement)", () => {
  const segs = buildSegments(POST, { alerts: [{ id: "a1", quote: "Ce protocole a réduit nos écarts de moitié depuis deux ans.", decision: "open" }], established: ["Le brief annonce un prix de sécurité."], interpretations: ["Chez nous, la rigueur commence en amont."] });
  assert.deepEqual(segs.filter((s) => s.kind !== "plain").map((s) => s.kind), ["fact", "view", "added"]);
  assert.equal(segs.map((s) => s.text).join(""), POST, "aucune lettre perdue ni ajoutée");
  assert.equal(segs.find((s) => s.kind === "added").id, "a1");
  const overlap = buildSegments(POST, { alerts: [{ id: "a1", quote: "Chez nous, la rigueur commence en amont.", decision: "open" }], interpretations: ["Chez nous, la rigueur commence en amont."] });
  assert.equal(overlap.filter((s) => s.kind === "added").length, 1);
  assert.equal(overlap.filter((s) => s.kind === "view").length, 0);
  assert.deepEqual(buildSegments("Texte seul.", {}).map((s) => s.kind), ["plain"]);
});
test("origine : un passage modifié ou introuvable n'est plus surligné", () => {
  const segs = buildSegments(POST, { alerts: [{ id: "a1", quote: "Ce protocole a réduit nos écarts de moitié depuis deux ans.", decision: "edited" }, { id: "a2", quote: "phrase absente", decision: "open" }] });
  assert.ok(segs.every((s) => s.kind === "plain"));
});
test("vérification : les faits établis sont exposés pour la lecture par origine, sans jamais devenir une alerte", () => {
  const parsed = { claims: [{ quote: "Le brief annonce un prix de sécurité.", category: "fait_etabli", gravite: "mineure", problem: "", justification: "" }, { quote: "Ce protocole a réduit nos écarts de moitié depuis deux ans.", category: "non_etayee", gravite: "bloquante", problem: "p", justification: "j" }] };
  const r = mapVerifierToAlerts({ parsed, text: POST, profile: {} });
  assert.deepEqual(r.established, ["Le brief annonce un prix de sécurité."]);
  assert.equal(r.alerts.length, 1);
  const state = applyVerification(idleReview(), POST, { ...r, verifiedAt: 1 });
  assert.deepEqual(state.established, r.established);
});
test("retirer : le passage disparaît proprement, seulement par geste explicite ; null si absent", () => {
  assert.equal(removePassage("A.\n\nB inutile.\n\nC.", "B inutile."), "A.\n\nC.");
  assert.equal(removePassage("A. B inutile. C.", "B inutile."), "A.  C.".replace("  ", "  "));
  assert.equal(removePassage("A.", "absent"), null);
});
test("reformulation groupée : un seul appel, une proposition par passage, bornée et nettoyée", () => {
  const items = [{ id: "a1", quote: "Ce protocole a réduit nos écarts de moitié depuis deux ans.", problem: "Résultat non fourni." }, { id: "a2", quote: "Chez nous, la rigueur commence en amont.", problem: "" }];
  const p = rewriteAllUserPrompt({ text: POST, items });
  assert.ok(p.includes("1. « Ce protocole") && p.includes("2. « Chez nous") && p.includes("N'ajoute AUCUN fait"));
  assert.ok(p.includes("ne doit PLUS affirmer le fait signalé") && rewriteUserPrompt({ text: POST, quote: "q", problem: "p" }).includes("ne doit PLUS affirmer le fait signalé"));
  const raw = JSON.stringify({ items: [{ n: 1, replacement: "Nous pensons que ce protocole peut réduire les écarts." }, { n: 2, replacement: "" }, { n: 9, replacement: "hors liste" }, { n: 1, replacement: "doublon" }] });
  const out = cleanReplacements(raw, items);
  assert.deepEqual(out.map((o) => o.id), ["a1"]);
  assert.equal(cleanReplacements("pas de json", items).length, 0);
  assert.ok(MAX_BATCH >= 8);
});
test("reformulation groupée : seules les propositions acceptées sont appliquées ; un passage devenu introuvable est ignoré, jamais forcé", () => {
  const pairs = [{ quote: "Ce protocole a réduit nos écarts de moitié depuis deux ans.", replacement: "Nous pensons que ce protocole peut réduire les écarts." }, { quote: "passage disparu", replacement: "x" }];
  const r = applyReplacements(POST, pairs);
  assert.equal(r.text, POST.replace("Ce protocole a réduit nos écarts de moitié depuis deux ans.", "Nous pensons que ce protocole peut réduire les écarts."));
  assert.deepEqual(r.applied.length, 1); assert.deepEqual(r.skipped, ["passage disparu"]);
  assert.equal(applyReplacements(POST, []).text, POST, "aucune acceptation : texte inchangé");
});
test("interface : formulation « ajouts du rédacteur », lecture par origine, validation avant toute application, aucune promesse", () => {
  const src = read("components/EditorialAdvisor.js");
  for (const k of ["ajout", "du rédacteur à valider", "Lecture du post par origine", "Version prudente proposée : à valider passage par passage", "Garder tel quel", "advisor-batch-apply", "advisor-remove"]) assert.ok(src.includes(k), k);
  assert.ok(/checked=\{Boolean\(state\.accepted\[p\.id\]\)\}/.test(src), "chaque proposition se coche ou se décoche");
  assert.ok(src.includes("Appliquer {chosen.length}"), "l'application est un geste explicite avec le nombre de reformulations");
});

// ── Compagnon éditorial : mise en avant et édition d'un brouillon existant ────────────────────────────────────────────────
test("compagnon : invitation après génération, repliable sans disparaître, couleur selon l'état", () => {
  const src = read("components/EditorialAdvisor.js");
  for (const k of ["Votre compagnon éditorial", "Votre post est prêt. Je le relis avec vous ?", "advisor-invite", "advisor-later", "Plus tard", "advisor-collapsed", "const ACCENT"]) assert.ok(src.includes(k), k);
  for (const etat of ["idle", "running", "error", "stale", "todo", "finished"]) assert.ok(new RegExp(`${etat}: "border-`).test(src), `couleur pour l'état ${etat}`);
  assert.ok(src.indexOf('const [dismissed') < src.indexOf('if (review.status === "idle" && dismissed)'), "hooks déclarés avant le retour anticipé");
  assert.ok(src.indexOf("const [showInterp") < src.indexOf('if (review.status === "idle" && dismissed)'), "aucun hook après le retour anticipé");
  assert.ok(!/100\s?%\s?fiable|fiabilité garantie|texte (est )?garanti/i.test(src), "toujours aucune promesse de fiabilité");
});
test("compagnon : en tête de la colonne du résultat, puis dans la page d'édition d'un brouillon existant, toujours derrière l'interrupteur", () => {
  const page = read("app/app/page.js");
  const iCard = page.indexOf("<ReviewCard\n                    key={advisorKey}"), iChat = page.indexOf("<RefineChat\n                    thread={thread}");
  assert.ok(iCard > 0 && iChat > 0 && iCard < iChat, "le compagnon précède « Améliorer ce post »");
  assert.ok(page.includes("{advisorOn && optimizeText.text?.trim() && ("), "page d'édition derrière le drapeau");
  assert.ok(page.includes("drafts.find((d) => d.id === optimizeText.draftId)?.theme"), "le brief du brouillon est celui enregistré");
  assert.ok(page.includes("key={optimizeText.draftId ?? \"post-en-cours\"}"), "une relecture par brouillon");
  assert.ok(page.includes("const focusOptPassage") && page.includes("const applyOptAdvisorText"));
  assert.ok(/applyOptAdvisorText = \(newText\) => \{\s*setVersions\(/.test(page) && !/applyOptAdvisorText[\s\S]{0,400}patchDraft/.test(page), "appliquer ne sauvegarde jamais : version récupérable, enregistrement explicite");
  assert.equal((page.match(/<ReviewCard/g) ?? []).length, 3, "trois emplacements seulement : résultat, page d'édition d'un brouillon, publication d'une campagne");
});

// ── 11. Activation par compte (Administration) ─────────────────────────────────────────────────────────────────────────────
test("activation par compte : décision selon le serveur, le périmètre et le compte", () => {
  assert.deepEqual(ADVISOR_MODES, ["all", "accounts", "off"]);
  const d = (o) => decideAdvisorAccess({ envOn: true, mode: "all", userAllowed: false, isAdmin: false, ...o });
  assert.equal(d({}), true, "tous les comptes : comportement d'avant");
  assert.equal(d({ mode: "off", userAllowed: true, isAdmin: true }), false, "personne, même coché ou administrateur");
  assert.equal(d({ mode: "accounts" }), false, "compte non coché");
  assert.equal(d({ mode: "accounts", userAllowed: true }), true, "compte coché");
  assert.equal(d({ mode: "accounts", isAdmin: true }), true, "administrateur toujours admis dans ce mode");
  assert.equal(d({ envOn: false, mode: "all", userAllowed: true, isAdmin: true }), false, "serveur coupé : rien ne rouvre l'accès");
  assert.equal(d({ mode: "inconnu" }), true, "valeur stockée inconnue : traitée en amont comme « all »");
});

test("activation par compte : serveur d'abord, compte ensuite, Administration réservée aux admins", () => {
  const pre = read("lib/advisorRoute.js");
  assert.ok(pre.indexOf("advisorEnabled()") < pre.indexOf("getEffectiveUserId(req)"));
  assert.ok(pre.indexOf("getEffectiveUserId(req)") < pre.indexOf("advisorAccessFor(userId)"), "le compte est connu avant le test d'accès");
  assert.ok(pre.indexOf("advisorAccessFor(userId)") < pre.indexOf("checkAccess(userId)") && pre.indexOf("advisorAccessFor(userId)") < pre.indexOf("rateLimit("), "accès refusé (404) avant toute consommation");
  const status = read("app/api/advisor/status/route.js");
  assert.ok(status.includes("advisorAccessFor(userId)") && status.includes("getEffectiveUserId(req)"), "le statut dépend du compte (y compris « Voir comme »)");
  assert.ok(status.includes("let enabled = false"), "sans compte ou en cas d'erreur : désactivé");
  const acc = read("lib/advisorAccess.js");
  assert.ok(acc.includes('return ADVISOR_MODES.includes(v.mode) ? v.mode : "all"'), "sans réglage stocké : tous les comptes");
  assert.ok(acc.includes("if (!advisorEnabled(env) || !userId) return false"));
  for (const f of ["app/api/admin/advisor/route.js"]) {
    const src = read(f);
    assert.equal((src.match(/requireAdmin\(req\)/g) ?? []).length, 2, "GET et PUT réservés aux administrateurs");
    assert.ok(src.includes("ADVISOR_MODES.includes(body.mode)"), "mode validé");
  }
  const users = read("app/api/admin/users/[id]/route.js");
  assert.ok(users.includes('typeof body.advisorAccess === "boolean"') && users.includes("requireAdmin(req)"));
  const schema = read("prisma/schema.prisma");
  assert.ok(/advisorAccess Boolean @default\(false\)/.test(schema), "colonne ajoutée, fermée par défaut (ajout simple, rien n'est perdu)");
  const page = read("app/app/page.js");
  assert.ok(page.includes("<AdminAdvisorCard") && page.includes("admin-advisor-toggle"), "carte de périmètre et bouton par compte dans l'Administration");
});

// ── 12. Conseiller dans les campagnes ──────────────────────────────────────────────────────────────────────────────────────
test("campagnes : le brief de vérification reprend ce que l'auteur a fourni, pas les règles ni les interdits", () => {
  const brief = { context: "Wharf accompagne des PME industrielles.", audiences: "Directions logistiques", objective: "Générer des rendez-vous", message: "Un indicateur, une définition.", rules: ["Pas d'emoji"], forbidden: ["Ne jamais citer de client"], sources: [{ label: "Site", url: "https://exemple.fr" }] };
  const facts = campaignFacts(brief, "Précision : le -20 % vient du tableau de bord achats.");
  assert.ok(facts.includes("Wharf accompagne") && facts.includes("Directions logistiques") && facts.includes("Un indicateur") && facts.includes("tableau de bord achats"));
  assert.ok(!/emoji|jamais citer|exemple\.fr/i.test(facts), "règles, interdits et liens ne sont pas des faits");
  const item = { angle: "Deux mesures du même délai", objective: "Faire réfléchir", cta: "Commenter", format: "texte", toConfirm: "Chiffre exact du trimestre", visual: "Schéma", media: "à produire" };
  const b = campaignItemBrief(item, facts);
  assert.ok(b.startsWith("Sujet et angle : Deux mesures du même délai"), "la publication d'abord, la campagne ensuite");
  assert.ok(b.includes("PAS confirmés") && b.includes("Chiffre exact du trimestre"), "les faits à confirmer sont signalés comme non établis");
  assert.ok(b.includes("Wharf accompagne"));
  assert.ok(!/Schéma|à produire/.test(b), "brief visuel et statut du média ne sont pas des faits");
  assert.equal(campaignItemBrief({}, "").length, 0);
});

test("campagnes : bornes de taille cohérentes avec la route de vérification", () => {
  const big = "x".repeat(20_000);
  assert.ok(campaignFacts({ context: big, message: big }, big).length <= CAMPAIGN_FACTS_MAX);
  const b = campaignItemBrief({ angle: big, objective: big, cta: big, toConfirm: big }, campaignFacts({ context: big }, ""));
  assert.ok(b.length <= ITEM_BRIEF_MAX + CAMPAIGN_FACTS_MAX + 2);
  assert.ok(ITEM_BRIEF_MAX + CAMPAIGN_FACTS_MAX + 2 <= 6000, "le tout tient dans la limite de la route (6000)");
  assert.ok(read("app/api/advisor/verify/route.js").includes(".slice(0, 6000)"));
});

test("campagnes : carte du compagnon dans le texte d'une publication, derrière le drapeau et sans publication automatique", () => {
  const page = read("app/app/page.js");
  const i = page.indexOf("function PlanText(");
  const body = page.slice(i, page.indexOf("function PlanEditor(", i) > i ? page.indexOf("function PlanEditor(", i) : i + 12000);
  assert.ok(body.includes("{advisor && !published && ("), "carte masquée si le compagnon est inactif pour ce compte ou si le post est publié");
  assert.ok(body.includes("campaignItemBrief(it, advisor.facts)") && body.includes("contextId={advisor.contextId || undefined}"));
  assert.ok(/applyAdvisorText = async \(next\)[\s\S]{0,400}\/text`, \{ method: "PUT"/.test(body), "« Appliquer » n'enregistre que le texte (route texte existante)");
  const apply = body.slice(body.indexOf("const applyAdvisorText"), body.indexOf("const validate = async"));
  assert.ok(apply.length > 100 && !/validate|publi|schedul|programm/i.test(apply), "ni validation, ni programmation, ni publication");
  assert.ok(page.includes("advisor={advisorOn ? { facts: data.campaign.advisorFacts"), "transmis seulement si actif");
  assert.ok(page.includes("key={`${it.id}:${it.draft.status}`}"), "la carte n'est pas remontée à chaque enregistrement du texte");
  assert.ok(read("lib/campaignPlanStore.js").includes("advisorFacts: campaignFacts(brief, c.context)"));
});
