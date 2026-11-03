"use client";
// Conseiller éditorial (V1, derrière EDITORIAL_ADVISOR=1) : questions avant la génération et relecture factuelle indépendante, à la demande.
// Aucun de ces composants ne modifie le texte sans geste explicite de l'utilisateur ; aucun ne bloque une publication.
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronUp, Pencil, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { idleReview, startReview, failReview, applyVerification, decide, syncWithText, openCount, reviewLabel, loadReview, saveReview, locatePassage, buildSegments, removePassage } from "@/lib/advisorReview";
import { applyReplacement, applyReplacements } from "@/lib/advisorRewrite";

// ── Interrupteur de développement ─────────────────────────────────────────────────────────────────────────────────────────
let cachedEnabled = null;
export function useAdvisorEnabled() {
  const [on, setOn] = useState(cachedEnabled ?? false);
  useEffect(() => {
    if (cachedEnabled !== null) { setOn(cachedEnabled); return; }
    let alive = true;
    fetch("/api/advisor/status").then((r) => r.json()).then((d) => { cachedEnabled = Boolean(d?.enabled); if (alive) setOn(cachedEnabled); }).catch(() => { cachedEnabled = false; });
    return () => { alive = false; };
  }, []);
  return on;
}

async function postJson(url, body, { timeoutMs = 70_000, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  signal?.addEventListener?.("abort", () => ctrl.abort());
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || "Une erreur est survenue."); err.status = res.status; throw err; }
    return data;
  } catch (e) {
    if (e?.name === "AbortError") throw new Error(signal?.aborted ? "Vérification annulée." : "La vérification a pris trop de temps. Votre texte est conservé : vous pouvez réessayer.");
    throw e;
  } finally { clearTimeout(timer); }
}

// ── Avant la génération : questions sur le brief ───────────────────────────────────────────────────────────────────────────────
export function analyzeBriefRequest(theme, expertise) { return postJson("/api/advisor/brief", { theme, expertise }, { timeoutMs: 25_000 }); }

const ISSUE_LABEL = { contradiction: "Deux informations se contredisent", missing: "Une information essentielle manque" };

export function BriefAdvisorCard({ analysis, onSubmit, onGenerateAnyway, onCancel, busy }) {
  const [answers, setAnswers] = useState({});
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const blocked = analysis.status === "blocked";
  const filled = analysis.issues.map((it, i) => ({ question: it.question, answer: (answers[i] ?? "").trim() })).filter((x) => x.answer);
  return (
    <section aria-label="Conseil éditorial avant la rédaction" className={`rounded-2xl border p-5 space-y-4 ${blocked ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`} data-testid="advisor-brief-card">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={18} className={`${blocked ? "text-amber-600" : "text-[#ff5a5f]"} mt-0.5 shrink-0`} aria-hidden="true" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#d63b42]">Votre compagnon éditorial</p>
          <h3 className="text-sm font-bold text-[#1b2a4a]">{blocked ? "Avant d'écrire : une contradiction à clarifier" : "Avant d'écrire : une précision utile"}</h3>
          <p className="text-xs text-[#5a6b85] mt-0.5">
            {blocked
              ? "Votre sujet contient deux informations qui ne peuvent pas être vraies en même temps. Plutôt que d'inventer une explication qui les concilie, dites-nous ce qui est exact."
              : "Sans cette information, le post risquerait d'inventer un fait. Une phrase suffit."}
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {analysis.issues.map((it, i) => (
          <div key={i} className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{ISSUE_LABEL[it.kind]}</p>
            {it.quotes?.length > 0 && <p className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2">{it.quotes.map((q) => `« ${q} »`).join(" · ")}</p>}
            <label htmlFor={`advisor-q-${i}`} className="block text-sm font-medium text-gray-800">{it.question}</label>
            {it.why && <p className="text-xs text-gray-500">{it.why}</p>}
            <textarea
              id={`advisor-q-${i}`}
              ref={i === 0 ? firstRef : undefined}
              rows={2}
              value={answers[i] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
              placeholder="Votre réponse (elle sera ajoutée à votre sujet)"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={() => onSubmit(filled)} disabled={busy || filled.length === 0} data-testid="advisor-brief-submit"
          className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px]">
          {busy ? <RefreshCw size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />} Ajouter et générer
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="text-sm text-gray-600 hover:bg-gray-100 px-4 py-2.5 rounded-lg min-h-[44px]">Modifier mon sujet</button>
      </div>
      <button type="button" onClick={onGenerateAnyway} disabled={busy} data-testid="advisor-brief-anyway" className="block text-xs text-gray-500 hover:text-gray-700 underline">
        {blocked ? "Générer quand même un brouillon exploratoire (la contradiction ne sera pas résolue)" : "Générer quand même, sans cette précision"}
      </button>
    </section>
  );
}

// ── Après la génération : « Vérifier mon post » ────────────────────────────────────────────────────────────────────────────
const CHIP = {
  idle: "bg-[#ff5a5f]/10 text-[#d63b42]",
  running: "bg-blue-50 text-blue-700",
  error: "bg-red-50 text-red-700",
  stale: "bg-amber-50 text-amber-800",
  todo: "bg-amber-50 text-amber-800",
  finished: "bg-emerald-50 text-emerald-700",
};
// Le compagnon est un bloc de premier plan : il prend la couleur de son état (invitation, en cours, à examiner, terminé, erreur)
const ACCENT = {
  idle: "border-[#ff5a5f]/40 bg-gradient-to-br from-[#fff1f1] via-white to-[#eef4ff] shadow-md",
  running: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white shadow-md",
  error: "border-red-200 bg-gradient-to-br from-red-50 via-white to-white shadow-md",
  stale: "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white shadow-md",
  todo: "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white shadow-md",
  finished: "border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-white shadow-md",
};
const BADGE = { unsupported: "bg-red-50 text-red-700 border-red-100", to_confirm: "bg-amber-50 text-amber-800 border-amber-100" };
const DECISION_TEXT = {
  confirmed: "Confirmé par vous. Aucune source indépendante n'a vérifié ce point.",
  ignored: "Vous avez choisi de garder cette formulation telle quelle.",
  edited: "Passage modifié ou retiré.",
};

function AlertItem({ alert, text, canAct, onDecide, onEditPassage, onApplyText, brief }) {
  const [proposal, setProposal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const decided = alert.decision !== "open";
  const present = locatePassage(text, alert.quote) !== null;
  const rewrite = async () => {
    setBusy(true); setErr("");
    try { const d = await postJson("/api/advisor/rewrite", { text, quote: alert.quote, problem: alert.problem }, { timeoutMs: 40_000 }); setProposal(d.replacement); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <li id={`advisor-alert-${alert.id}`} tabIndex={-1} className={`rounded-xl border p-3.5 space-y-2 scroll-mt-24 outline-none focus:ring-2 focus:ring-[#ff5a5f] ${decided ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200"}`} data-testid="advisor-alert" data-decision={alert.decision} data-category={alert.category}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${BADGE[alert.category]}`}>{alert.title}</span>
        {decided && <span className="text-[11px] text-gray-500">{DECISION_TEXT[alert.decision]}</span>}
      </div>
      <blockquote className="text-sm text-gray-800"><mark className="bg-yellow-100 rounded px-0.5">{alert.quote}</mark></blockquote>
      {!decided && (
        <>
          {alert.problem && <p className="text-sm text-gray-700">{alert.problem}</p>}
          {alert.justification && <p className="text-xs text-gray-500">{alert.justification}</p>}
          <p className="text-xs text-[#5a6b85]"><strong className="font-semibold">Que faire :</strong> {alert.action}</p>
        </>
      )}
      {proposal && (
        <div className="rounded-lg bg-[#f4f8ff] border border-[#d8e6fb] p-3 space-y-2" aria-live="polite">
          <p className="text-[11px] font-semibold text-[#0a66c2] uppercase tracking-wide">Proposition de reformulation prudente</p>
          <p className="text-sm text-gray-800">{proposal}</p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => { const next = applyReplacement(text, alert.quote, proposal); if (next) onApplyText(next); setProposal(null); }} className="bg-[#0a66c2] text-white text-xs px-3 py-2 rounded-lg min-h-[36px]" data-testid="advisor-apply">Appliquer cette reformulation</button>
            <button type="button" onClick={() => setProposal(null)} className="text-xs text-gray-600 px-3 py-2 rounded-lg hover:bg-white min-h-[36px]">Garder mon texte</button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
      <div className="flex gap-2 flex-wrap pt-0.5">
        {!decided ? (
          <>
            <button type="button" disabled={!canAct} onClick={() => onDecide(alert.id, "confirmed")} className="text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-40 px-3 py-2 rounded-lg flex items-center gap-1.5 min-h-[36px]" data-testid="advisor-confirm"><Check size={13} aria-hidden="true" /> Confirmer</button>
            <button type="button" disabled={!canAct || !present} onClick={() => { const next = removePassage(text, alert.quote); if (next) onApplyText(next); }} className="text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-40 px-3 py-2 rounded-lg flex items-center gap-1.5 min-h-[36px]" data-testid="advisor-remove"><X size={13} aria-hidden="true" /> Retirer</button>
            <button type="button" disabled={!canAct || !present} onClick={() => onEditPassage(alert.quote)} className="text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-40 px-3 py-2 rounded-lg flex items-center gap-1.5 min-h-[36px]" data-testid="advisor-edit"><Pencil size={13} aria-hidden="true" /> Modifier</button>
            <button type="button" disabled={!canAct || !present || busy} onClick={rewrite} className="text-xs border border-gray-300 hover:bg-gray-50 disabled:opacity-40 px-3 py-2 rounded-lg flex items-center gap-1.5 min-h-[36px]" data-testid="advisor-rewrite">{busy ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />} Reformuler prudemment</button>
            <button type="button" disabled={!canAct} onClick={() => onDecide(alert.id, "ignored")} className="text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40 px-3 py-2 rounded-lg flex items-center gap-1.5 min-h-[36px]" data-testid="advisor-ignore">Garder tel quel</button>
          </>
        ) : alert.decision !== "edited" ? (
          <button type="button" onClick={() => onDecide(alert.id, "open")} className="text-xs text-[#0a66c2] hover:underline px-1 py-1 min-h-[28px]">Revenir sur ce choix</button>
        ) : null}
      </div>
    </li>
  );
}

// ── Lecture du post par origine : établi par le brief / conviction / ajout du rédacteur ─────────────────────────────────────
const SEG_CLASS = {
  fact: "bg-emerald-50 text-emerald-900 rounded px-0.5",
  view: "bg-sky-50 text-sky-900 rounded px-0.5",
  added: "bg-yellow-100 text-gray-900 rounded px-0.5 underline decoration-dotted decoration-yellow-600 cursor-pointer",
};
function OriginView({ text, review }) {
  const segs = buildSegments(text, { alerts: review.alerts, established: review.established, interpretations: review.interpretations });
  if (!segs.some((s) => s.kind !== "plain")) return null;
  const goTo = (id) => { const el = document.getElementById(`advisor-alert-${id}`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus({ preventScroll: true }); } };
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2" data-testid="advisor-origin">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Lecture du post par origine</p>
      <p className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
        <span><span className={SEG_CLASS.fact}>vert</span> : établi par votre brief</span>
        <span><span className={SEG_CLASS.view}>bleu</span> : conviction ou interprétation</span>
        <span><span className={SEG_CLASS.added}>jaune</span> : ajouté par le rédacteur, à valider</span>
      </p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
        {segs.map((s, i) => s.kind === "plain" ? <span key={i}>{s.text}</span>
          : s.kind === "added" ? <button key={i} type="button" onClick={() => goTo(s.id)} className={`${SEG_CLASS.added} text-left`} title="Voir cet ajout dans la liste">{s.text}</button>
          : <span key={i} className={SEG_CLASS[s.kind]}>{s.text}</span>)}
      </p>
    </div>
  );
}

// ── Reformulation prudente de tous les ajouts à la fois, validée passage par passage ───────────────────────────────────────
function BatchRewrite({ text, alerts, canAct, onApplyText }) {
  const [state, setState] = useState({ phase: "idle", proposals: [], accepted: {}, error: "" });
  const targets = alerts.filter((a) => a.decision === "open" && locatePassage(text, a.quote));
  const run = async () => {
    setState({ phase: "loading", proposals: [], accepted: {}, error: "" });
    try {
      const d = await postJson("/api/advisor/rewrite-all", { text, items: targets.map((a) => ({ id: a.id, quote: a.quote, problem: a.problem })) }, { timeoutMs: 55_000 });
      setState({ phase: "review", proposals: d.proposals, accepted: Object.fromEntries(d.proposals.map((p) => [p.id, true])), error: "" });
    } catch (e) { setState({ phase: "idle", proposals: [], accepted: {}, error: e.message }); }
  };
  const chosen = state.proposals.filter((p) => state.accepted[p.id]);
  const apply = () => { const r = applyReplacements(text, chosen); if (r.applied.length) onApplyText(r.text); setState({ phase: "idle", proposals: [], accepted: {}, error: r.skipped.length ? "Certains passages n'ont pas pu être remplacés : ils ont changé entre-temps." : "" }); };
  if (state.phase === "review") {
    return (
      <div className="rounded-xl bg-[#f4f8ff] border border-[#d8e6fb] p-3.5 space-y-3" data-testid="advisor-batch" aria-live="polite">
        <p className="text-[11px] font-semibold text-[#0a66c2] uppercase tracking-wide">Version prudente proposée : à valider passage par passage</p>
        <ul className="space-y-3">
          {state.proposals.map((p) => (
            <li key={p.id} className="space-y-1">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1" checked={Boolean(state.accepted[p.id])} onChange={(e) => setState((st) => ({ ...st, accepted: { ...st.accepted, [p.id]: e.target.checked } }))} />
                <span className="space-y-1">
                  <span className="block text-xs text-gray-500 line-through">{p.quote}</span>
                  <span className="block text-gray-900">{p.replacement}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-500">Une reformulation peut conserver une part du fait signalé : relancez la vérification après application, ou retirez le passage.</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" disabled={!chosen.length} onClick={apply} className="bg-[#0a66c2] disabled:bg-gray-300 text-white text-xs px-3 py-2 rounded-lg min-h-[36px]" data-testid="advisor-batch-apply">Appliquer {chosen.length} reformulation{chosen.length > 1 ? "s" : ""}</button>
          <button type="button" onClick={() => setState({ phase: "idle", proposals: [], accepted: {}, error: "" })} className="text-xs text-gray-600 px-3 py-2 rounded-lg hover:bg-white min-h-[36px]">Garder mon texte</button>
        </div>
      </div>
    );
  }
  if (!targets.length) return null;
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={run} disabled={!canAct || state.phase === "loading"} data-testid="advisor-batch-run" className="w-full text-sm border border-[#0a66c2] text-[#0a66c2] hover:bg-[#f4f8ff] disabled:opacity-40 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px]">
        {state.phase === "loading" ? <RefreshCw size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />} {targets.length > 1 ? `Proposer une version prudente des ${targets.length} ajouts` : "Proposer une version prudente de l'ajout"}
      </button>
      {state.error && <p className="text-xs text-red-600" role="alert">{state.error}</p>}
    </div>
  );
}

// text : texte actuel du post ; brief : sujet d'origine (avec précisions) ; disabled : édition en cours ; onEditPassage / onApplyText : gestes explicites sur le texte
export function ReviewCard({ text, brief, contextId, sourceIds, source, disabled, onEditPassage, onApplyText, intro = "Votre post est prêt. Je le relis avec vous ?" }) {
  const [review, setReview] = useState(() => idleReview());
  const [dismissed, setDismissed] = useState(false); // « Plus tard » : le compagnon se replie en barre, sans disparaître
  const [showInterp, setShowInterp] = useState(false);
  const abortRef = useRef(null);
  const storage = () => { try { return window.localStorage; } catch { return null; } };

  // Le texte change : le résultat précédent devient caduc (ou se retrouve si l'on revient à un texte déjà relu)
  useEffect(() => {
    setReview((prev) => {
      if (prev.status === "running") return prev;
      const restored = prev.textHash === null || prev.status === "idle" || prev.status === "stale" || prev.status === "error" ? loadReview(storage(), text) : null;
      if (restored && restored.textHash !== prev.textHash) return restored;
      return syncWithText(prev, text);
    });
  }, [text]);
  useEffect(() => { saveReview(storage(), review); }, [review]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const verify = async () => {
    if (!text?.trim() || review.status === "running") return;
    const before = review;
    setReview(startReview(before));
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const d = await postJson("/api/advisor/verify", { text, brief, contextId: contextId || undefined, sourceIds: sourceIds ?? undefined, source: source ? { title: source.title, origin: source.origin, text: source.text } : undefined }, { signal: ctrl.signal });
      setReview(applyVerification(before, text, d));
    } catch (e) { setReview(failReview(before, e.message)); }
  };
  const cancel = () => { abortRef.current?.abort(); };
  const onDecide = (id, decision) => setReview((r) => decide(r, id, decision));

  const lab = reviewLabel(review);
  const open = openCount(review);
  const running = review.status === "running";
  const hasList = (review.status === "done" || review.status === "stale") && review.alerts.length > 0;
  const stale = review.status === "stale";
  if (review.status === "idle" && dismissed) {
    return (
      <button type="button" onClick={() => setDismissed(false)} data-testid="advisor-collapsed"
        className="w-full flex items-center justify-between gap-3 rounded-2xl border-2 border-[#ff5a5f]/40 bg-gradient-to-r from-[#fff1f1] to-[#eef4ff] px-5 py-3.5 text-left hover:border-[#ff5a5f] focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]">
        <span className="flex items-center gap-2.5">
          <span className="bg-[#ff5a5f] text-white p-2 rounded-xl shrink-0" aria-hidden="true"><Sparkles size={16} /></span>
          <span><span className="block font-bold text-sm text-[#1b2a4a]">Votre compagnon éditorial</span><span className="block text-xs text-[#5a6b85]">Relire ce post avec vous : ce qui dépasse votre brief</span></span>
        </span>
        <ChevronDown size={18} className="text-[#ff5a5f] shrink-0" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section aria-label="Relecture factuelle indépendante" className={`rounded-2xl border-2 p-5 space-y-3 ${ACCENT[lab.code] ?? ACCENT.idle}`} data-testid="advisor-review" data-state={lab.code}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-[#ff5a5f] text-white p-2 rounded-xl shrink-0" aria-hidden="true"><Sparkles size={16} /></span>
          <div>
            <h3 className="font-extrabold text-sm text-[#1b2a4a] leading-tight">Votre compagnon éditorial</h3>
            <p className="text-[11px] text-[#5a6b85]">Relecture factuelle</p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${CHIP[lab.code]}`} data-testid="advisor-state">{lab.label}</span>
      </div>
      <div aria-live="polite" className="sr-only">{running ? "Vérification en cours" : lab.label}</div>

      {review.status === "idle" && (
        <div className="space-y-1.5">
          <p className="text-base font-bold text-[#1b2a4a]" data-testid="advisor-invite">{intro}</p>
          <p className="text-sm text-[#5a6b85]">Le rédacteur peut ajouter des détails que votre brief ne contient pas. Je les repère ; vous validez, reformulez ou retirez chacun. C'est un avis, pas une preuve : vous décidez.</p>
        </div>
      )}
      {running && (
        <div className="flex items-center gap-2 text-sm text-blue-700" role="status"><RefreshCw size={15} className="animate-spin" aria-hidden="true" /> Relecture en cours, une dizaine de secondes…
          <button type="button" onClick={cancel} className="ml-auto text-xs text-gray-500 hover:underline">Annuler</button></div>
      )}
      {review.status === "error" && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3 flex gap-2" role="alert"><AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {review.error}</div>
      )}
      {stale && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3" role="status">Le texte a changé depuis la dernière vérification : ce résultat n'est plus à jour. Les choix que vous avez faits sont conservés pour les passages inchangés.</div>
      )}
      {review.status === "done" && review.alerts.length === 0 && (
        <p className="text-sm text-gray-700 flex gap-2"><CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" /> Aucun point signalé. Cela ne garantit pas que le texte est exact : vérifiez ce que vous affirmez.</p>
      )}
      {review.status === "done" && review.alerts.length > 0 && open === 0 && (
        <p className="text-sm text-gray-700 flex gap-2"><CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" /> Tous les points ont été traités. Vos confirmations n'ont pas été vérifiées par une source indépendante.</p>
      )}
      {review.status === "done" && open > 0 && <p className="text-sm text-gray-700">{open} ajout{open > 1 ? "s" : ""} du rédacteur à valider : ce que le post affirme au-delà de votre brief. Traitez-les un par un : rien n'est modifié sans votre accord.</p>}
      {(review.status === "done" || stale) && review.alerts.length > 0 && <OriginView text={text} review={review} />}
      {(review.status === "done" || stale) && <BatchRewrite text={text} alerts={review.alerts} canAct={!disabled && !running} onApplyText={onApplyText} />}

      {hasList && (
        <ul className="space-y-2.5" aria-label="Points signalés">
          {review.alerts.map((a) => (
            <AlertItem key={a.id} alert={a} text={text} brief={brief} canAct={!disabled && !running} onDecide={onDecide} onEditPassage={onEditPassage} onApplyText={onApplyText} />
          ))}
        </ul>
      )}

      {(review.status === "done" || stale) && review.interpretations?.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowInterp((s) => !s)} className="text-xs text-[#5a6b85] flex items-center gap-1" aria-expanded={showInterp}>
            {showInterp ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />} {review.interpretations.length} passage{review.interpretations.length > 1 ? "s" : ""} lu{review.interpretations.length > 1 ? "s" : ""} comme conviction ou interprétation (aucune alerte)
          </button>
          {showInterp && <ul className="mt-1.5 space-y-1 text-xs text-gray-500 list-disc pl-5">{review.interpretations.map((q, i) => <li key={i}>{q}</li>)}</ul>}
        </div>
      )}

      {!running && review.status === "idle" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={verify} disabled={disabled || !text?.trim()} data-testid="advisor-verify"
            className="flex-1 text-sm font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2 min-h-[48px] bg-[#ff5a5f] hover:bg-[#f63d44] text-white shadow-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff5a5f]">
            <Search size={16} aria-hidden="true" /> Vérifier mon post
          </button>
          <button type="button" onClick={() => setDismissed(true)} data-testid="advisor-later" className="text-sm text-gray-600 hover:bg-white px-4 py-3 rounded-xl min-h-[48px]">Plus tard</button>
        </div>
      )}
      {!running && review.status !== "idle" && (
        <button type="button" onClick={verify} disabled={disabled || !text?.trim()} data-testid="advisor-verify"
          className={`w-full text-sm font-medium px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-40 ${review.status === "error" || stale ? "bg-[#1b2a4a] hover:bg-[#2a3d66] text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>
          <Search size={15} aria-hidden="true" /> {review.status === "error" ? "Réessayer la vérification" : stale ? "Vérifier à nouveau" : "Revérifier"}
        </button>
      )}
      {disabled && <p className="text-[11px] text-gray-400">Validez ou annulez votre modification pour lancer la vérification.</p>}
      <p className="text-[11px] text-gray-400">Avis d'un relecteur automatique indépendant : ce n'est pas une preuve. Aucune publication n'est bloquée par cet avis.</p>
    </section>
  );
}
