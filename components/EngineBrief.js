"use client";
import { useState } from "react";
import { Check, X, Pencil, Trash2, Sparkles } from "lucide-react";

// Synthèse « Ce que le moteur a appris de vous » : ce que l'auteur a validé reste toujours affiché ; les nouveautés d'une actualisation
// arrivent à part, marquées « Nouveau », à valider, modifier ou supprimer. Rien n'est effacé ni remplacé sans son accord.
const SECTION = {
  positions: { label: "Ce que vous défendez", bullet: "•", tone: "text-[#ff5a5f]" },
  proofs: { label: "Chiffres et preuves retenus", bullet: "›", tone: "text-gray-400" },
  gaps: { label: "Ce que je ne sais pas encore", bullet: "?", tone: "text-amber-500" },
};
const SECTIONS = Object.entries(SECTION).map(([field, v]) => ({ field, ...v }));
const TEXTS = [
  { field: "headline", label: null, cls: "font-medium text-[#1b2a4a]" },
  { field: "business", label: null, cls: "" },
  { field: "voice", label: "Votre façon de vous exprimer", cls: "" },
];
const label = "text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1.5";
const btn = "text-[11px] hover:underline";

export default function EngineBrief({ brief, onOp, onAsk, asking = false, busy = false }) {
  const [edit, setEdit] = useState(null); // { field, index, proposal, text }
  const p = brief.proposals ?? {};
  const total = TEXTS.filter((t) => p[t.field]).length + [...SECTIONS.map((s) => s.field), "questions"].reduce((n, f) => n + (p[f]?.length ?? 0), 0);

  const save = async () => {
    if (!edit || edit.text.trim().length < 3) return;
    await onOp({ action: edit.proposal ? "accept" : "edit", field: edit.field, index: edit.index, text: edit.text.trim() });
    setEdit(null);
  };
  const Editor = () => (
    <div className="space-y-1.5" data-testid="engine-editor">
      <textarea value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} rows={3} maxLength={540} autoFocus className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]" data-testid="engine-editor-text" />
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy || edit.text.trim().length < 3} className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-xs px-3 py-1 rounded-lg" data-testid="engine-editor-save">{edit.proposal ? "Valider" : "Enregistrer"}</button>
        <button type="button" onClick={() => setEdit(null)} className="text-xs text-gray-500 px-2">Annuler</button>
      </div>
    </div>
  );
  const isEditing = (field, index, proposal) => edit && edit.field === field && edit.index === index && Boolean(edit.proposal) === proposal;

  // Rubrique de texte : la version validée, et la mise à jour proposée à côté
  const Text = ({ field, cls }) => (
    <div>
      {brief[field] && (isEditing(field, undefined, false) ? <Editor /> : (
        <div className="group flex items-start gap-2" data-testid={`engine-${field}`}>
          <p className={`flex-1 ${cls}`}>{brief[field]}</p>
          <span className="shrink-0 flex gap-2 opacity-60 group-hover:opacity-100">
            <button type="button" onClick={() => setEdit({ field, text: brief[field] })} className={`${btn} text-[#0a66c2]`} aria-label="Modifier" data-testid="engine-item-edit"><Pencil size={12} /></button>
            <button type="button" onClick={() => onOp({ action: "delete", field })} className={`${btn} text-gray-400 hover:text-red-600`} aria-label="Supprimer" data-testid="engine-item-delete"><Trash2 size={12} /></button>
          </span>
        </div>
      ))}
      {p[field] && (
        <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2" data-testid="engine-proposal">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-0.5">{brief[field] ? "Mise à jour proposée" : "Nouveau"}</p>
          {isEditing(field, undefined, true) ? <Editor /> : (
            <>
              <p className={cls}>{p[field]}</p>
              <p className="mt-1.5 flex gap-3">
                <button type="button" onClick={() => onOp({ action: "accept", field })} disabled={busy} className={`${btn} font-semibold text-green-700`} data-testid="engine-proposal-accept">Valider</button>
                <button type="button" onClick={() => setEdit({ field, proposal: true, text: p[field] })} className={`${btn} text-[#0a66c2]`} data-testid="engine-proposal-edit">Modifier</button>
                <button type="button" onClick={() => onOp({ action: "dismiss", field })} disabled={busy} className={`${btn} text-gray-400 hover:text-red-600`} data-testid="engine-proposal-dismiss">Supprimer</button>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3 text-sm text-gray-700" data-testid="engine-brief">
      {total > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap" data-testid="engine-proposals-banner">
          <p className="text-xs text-amber-900"><Sparkles size={13} className="inline -mt-0.5 mr-1" /><strong>{total} {total > 1 ? "ajouts proposés" : "ajout proposé"}</strong> par le moteur. Rien n&apos;est appliqué sans votre accord : validez, modifiez ou supprimez chacun.</p>
          <button type="button" onClick={() => onOp({ action: "acceptAll" })} disabled={busy} className="text-xs font-semibold bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 px-3 py-1 rounded-lg" data-testid="engine-accept-all">Tout valider</button>
        </div>
      )}
      <Text field="headline" cls="font-medium text-[#1b2a4a]" />
      <Text field="business" cls="" />
      {["positions", "voice", "proofs", "gaps"].map((field) => {
        if (field === "voice") return <div key="voice" data-testid="engine-section-voice">{(brief.voice || p.voice) ? <p className={label}>Votre façon de vous exprimer</p> : null}<Text field="voice" cls="" /></div>;
        const { label: l, bullet, tone } = SECTION[field];
        const items = brief[field] ?? [];
        const props = p[field] ?? [];
        if (!items.length && !props.length) return null;
        return (
          <div key={field} data-testid={`engine-section-${field}`}>
            <p className={label}>{l}</p>
            <ul className="space-y-1">
              {items.map((it, i) => (
                <li key={`${i}-${it}`} className="group flex gap-2" data-testid="engine-item">
                  <span className={tone}>{bullet}</span>
                  {isEditing(field, i, false) ? <div className="flex-1"><Editor /></div> : (
                    <>
                      <span className="flex-1">{it}</span>
                      <span className="shrink-0 flex gap-2 opacity-60 group-hover:opacity-100">
                        <button type="button" onClick={() => setEdit({ field, index: i, text: it })} className="text-[#0a66c2]" aria-label="Modifier" data-testid="engine-item-edit"><Pencil size={12} /></button>
                        <button type="button" onClick={() => onOp({ action: "delete", field, index: i })} className="text-gray-400 hover:text-red-600" aria-label="Supprimer" data-testid="engine-item-delete"><Trash2 size={12} /></button>
                      </span>
                    </>
                  )}
                </li>
              ))}
              {props.map((it, i) => (
                <li key={`p${i}-${it}`} className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2" data-testid="engine-proposal">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mr-2">Nouveau</span>
                  {isEditing(field, i, true) ? <Editor /> : (
                    <>
                      <span>{it}</span>
                      <span className="mt-1.5 flex gap-3">
                        <button type="button" onClick={() => onOp({ action: "accept", field, index: i })} disabled={busy} className={`${btn} font-semibold text-green-700`} data-testid="engine-proposal-accept">Valider</button>
                        <button type="button" onClick={() => setEdit({ field, index: i, proposal: true, text: it })} className={`${btn} text-[#0a66c2]`} data-testid="engine-proposal-edit">Modifier</button>
                        <button type="button" onClick={() => onOp({ action: "dismiss", field, index: i })} disabled={busy} className={`${btn} text-gray-400 hover:text-red-600`} data-testid="engine-proposal-dismiss">Supprimer</button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {((brief.questions?.length ?? 0) > 0 || (p.questions?.length ?? 0) > 0) && (
        <div>
          <p className={label}>Pour m&apos;aider à mieux vous comprendre</p>
          <div className="flex flex-wrap gap-1.5">
            {(brief.questions ?? []).map((q, i) => (
              <span key={`${i}-${q}`} className="inline-flex items-center text-xs rounded-full border border-gray-200 hover:border-[#ff5a5f]">
                <button type="button" onClick={() => onAsk(q)} disabled={asking} className="px-2.5 py-1 hover:text-[#ff5a5f] text-left">{q}</button>
                <button type="button" onClick={() => onOp({ action: "delete", field: "questions", index: i })} className="pr-2 text-gray-300 hover:text-red-600" aria-label="Supprimer la question"><X size={11} /></button>
              </span>
            ))}
            {(p.questions ?? []).map((q, i) => (
              <span key={`p${i}-${q}`} className="inline-flex items-center gap-1 text-xs rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1" data-testid="engine-proposal">
                <span className="text-[10px] font-semibold uppercase text-amber-700">Nouveau</span> {q}
                <button type="button" onClick={() => onOp({ action: "accept", field: "questions", index: i })} className="text-green-700 ml-1" aria-label="Valider" data-testid="engine-proposal-accept"><Check size={12} /></button>
                <button type="button" onClick={() => onOp({ action: "dismiss", field: "questions", index: i })} className="text-gray-400 hover:text-red-600" aria-label="Supprimer" data-testid="engine-proposal-dismiss"><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
