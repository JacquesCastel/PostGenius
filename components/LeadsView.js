"use client";
import { useState, useEffect, useMemo } from "react";
import { Users, Sparkles, Plus, Trash2, Pencil, ExternalLink, Download, Check } from "lucide-react";
import { LEVELS, LEVEL_LABEL, STATUSES } from "@/lib/leadsText";

// Base de leads : les personnes qui commentent la page entreprise arrivent ici toutes seules ; on peut aussi en ajouter à la main.
// L'IA les note face au client idéal décrit ci-dessous. Aucun message n'est envoyé : la prise de contact reste manuelle.

const STATUS_LABEL = { new: "Nouveau", tocontact: "À contacter", contacted: "Contacté", won: "Gagné", lost: "Perdu" };
const LEVEL_STYLE = { excellent: "bg-green-100 text-green-800", bon: "bg-emerald-50 text-emerald-700", moyen: "bg-amber-50 text-amber-700", faible: "bg-gray-100 text-gray-500" };
const json = async (res) => res.json().catch(() => ({}));
const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-5";
const field = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";

function csv(leads) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Nom", "Poste", "Entreprise", "Niveau", "Raison", "Statut", "Commentaire", "Post", "Profil", "Note", "Date"];
  const rows = leads.map((l) => [l.name, l.headline, l.company, LEVEL_LABEL[l.level] ?? "", l.reason, STATUS_LABEL[l.status], l.commentText, l.postUrl, l.profileUrl, l.note, l.createdAt?.slice(0, 10)]);
  return [head, ...rows].map((r) => r.map(q).join(";")).join("\n");
}

function LeadCard({ lead, onChange, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: lead.name ?? "", headline: lead.headline ?? "", company: lead.company ?? "", profileUrl: lead.profileUrl ?? "" });
  const [note, setNote] = useState(lead.note ?? "");
  const patch = (body) => onChange(lead.id, body);
  return (
    <div className={card} data-testid="lead-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words" data-testid="lead-name">{lead.name || "Personne LinkedIn (nom non communiqué)"}</p>
          {(lead.headline || lead.company) && <p className="text-xs text-gray-500 break-words">{[lead.headline, lead.company].filter(Boolean).join(" · ")}</p>}
        </div>
        {lead.level ? <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${LEVEL_STYLE[lead.level]}`} data-testid="lead-level">{LEVEL_LABEL[lead.level]}</span> : <span className="text-xs text-gray-400 shrink-0" data-testid="lead-unscored">Pas encore noté</span>}
      </div>
      {lead.reason && <p className="text-xs text-gray-600 mt-2">{lead.reason}</p>}
      {lead.commentText && <p className="text-sm text-gray-700 mt-3 border-l-2 border-gray-200 pl-3 whitespace-pre-wrap break-words">« {lead.commentText} »</p>}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
        <select value={lead.status} onChange={(e) => patch({ status: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1" data-testid="lead-status" aria-label="Statut">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {lead.postUrl && <a href={lead.postUrl} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] flex items-center gap-1"><ExternalLink size={12} /> Voir le post</a>}
        {lead.profileUrl && <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] flex items-center gap-1"><ExternalLink size={12} /> Profil</a>}
        <button type="button" onClick={() => setEdit((v) => !v)} className="text-gray-500 flex items-center gap-1" data-testid="lead-edit"><Pencil size={12} /> {edit ? "Fermer" : "Modifier"}</button>
        <button type="button" onClick={() => onDelete(lead.id)} className="text-gray-400 hover:text-red-500 flex items-center gap-1 ml-auto" data-testid="lead-delete"><Trash2 size={12} /> Supprimer</button>
      </div>
      {edit && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-400">LinkedIn ne donne pas toujours le nom ni le poste. Complétez-les ici : le lead sera renoté avec ces informations.</p>
          {[["name", "Nom"], ["headline", "Poste"], ["company", "Entreprise"], ["profileUrl", "Adresse du profil LinkedIn"]].map(([k, label]) => (
            <input key={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={label} aria-label={label} className={field} data-testid={`lead-f-${k}`} />
          ))}
          <button type="button" onClick={async () => { await patch(f); setEdit(false); }} className="text-sm font-medium px-4 py-2 rounded-lg bg-[#ff5a5f] text-white flex items-center gap-2" data-testid="lead-save"><Check size={14} /> Enregistrer</button>
        </div>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (lead.note ?? "") && patch({ note })} placeholder="Note (ce que vous vous êtes dit, prochaine étape…)" rows={2} className={`${field} mt-3 text-xs`} data-testid="lead-note" />
    </div>
  );
}

export default function LeadsView({ showToast }) {
  const [data, setData] = useState(null);
  const [icp, setIcp] = useState("");
  const [icpSaved, setIcpSaved] = useState(true);
  const [busy, setBusy] = useState(null); // "icp" | "score"
  const [filter, setFilter] = useState({ status: "", level: "" });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", headline: "", company: "", commentText: "" });
  const [error, setError] = useState(null);

  const load = async () => {
    const d = await fetch("/api/leads").then(json);
    if (d.leads) { setData(d); setIcp(d.icp ?? ""); }
    else setError(d.error || "Chargement impossible");
  };
  useEffect(() => { load().catch(() => setError("Chargement impossible")); }, []);

  const saveIcp = async () => {
    setBusy("icp");
    const res = await fetch("/api/leads/icp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ icp }) });
    setBusy(null);
    if (res.ok) { setIcpSaved(true); showToast("Client idéal enregistré ✓"); } else showToast((await json(res)).error || "Enregistrement impossible");
  };
  const score = async () => {
    if (busy) return;
    if (!icpSaved) await saveIcp();
    setBusy("score");
    setError(null);
    try {
      const res = await fetch("/api/leads/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await json(res);
      if (!res.ok) throw new Error(d.error || "Qualification impossible");
      showToast(d.scored ? `${d.scored} lead${d.scored > 1 ? "s" : ""} qualifié${d.scored > 1 ? "s" : ""}${d.left ? ` · ${d.left} restant${d.left > 1 ? "s" : ""}, relancez` : " ✓"}` : "Rien à qualifier");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const change = async (id, body) => {
    const res = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await json(res);
    if (!res.ok) return showToast(d.error || "Modification impossible");
    setData((x) => ({ ...x, leads: x.leads.map((l) => (l.id === id ? d.lead : l)) }));
  };
  const remove = async (id) => {
    if (!window.confirm("Supprimer ce lead ?")) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) setData((x) => ({ ...x, leads: x.leads.filter((l) => l.id !== id) }));
  };
  const add = async () => {
    const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const d = await json(res);
    if (!res.ok) return showToast(d.error || "Ajout impossible");
    setData((x) => ({ ...x, leads: [d.lead, ...x.leads] }));
    setDraft({ name: "", headline: "", company: "", commentText: "" });
    setAdding(false);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + csv(data.leads)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const leads = data?.leads ?? [];
  const shown = useMemo(() => leads.filter((l) => (!filter.status || l.status === filter.status) && (!filter.level || (filter.level === "none" ? !l.level : l.level === filter.level))), [leads, filter]);
  const unscored = leads.filter((l) => !l.level).length;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4" data-testid="leads-view">
      <div className={card}>
        <p className="text-sm font-semibold flex items-center gap-2"><Users size={15} className="text-[#ff5a5f]" /> Base de leads</p>
        <p className="text-xs text-gray-400 mt-1">Les personnes qui commentent votre page entreprise sont ajoutées ici automatiquement, avec leur commentaire. L&apos;IA les note selon votre client idéal. LinkeePost n&apos;envoie aucun message : le contact reste entre vos mains.</p>
        <label className="block text-xs font-medium text-gray-500 mt-4 mb-1">Votre client idéal</label>
        <textarea value={icp} onChange={(e) => { setIcp(e.target.value); setIcpSaved(false); }} rows={3} maxLength={800} placeholder="Ex. : dirigeants de PME de 20 à 200 salariés en France, qui veulent développer leur marque employeur" className={field} data-testid="leads-icp" />
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={saveIcp} disabled={busy || icpSaved} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-40" data-testid="leads-icp-save">Enregistrer</button>
          <button type="button" onClick={score} disabled={busy || !icp.trim() || !leads.length} className="text-sm font-medium px-4 py-2 rounded-lg bg-[#ff5a5f] text-white flex items-center gap-2 disabled:opacity-40" data-testid="leads-score"><Sparkles size={14} /> {busy === "score" ? "Qualification…" : unscored ? `Qualifier avec l'IA (${unscored})` : "Tout est qualifié"}</button>
          <button type="button" onClick={() => setAdding((v) => !v)} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 flex items-center gap-2" data-testid="leads-add"><Plus size={14} /> Ajouter une personne</button>
          {leads.length > 0 && <button type="button" onClick={download} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 flex items-center gap-2" data-testid="leads-csv"><Download size={14} /> Exporter</button>}
        </div>
        {error && <p className="text-xs text-red-600 mt-2" data-testid="leads-error">{error}</p>}
      </div>

      {adding && (
        <div className={`${card} space-y-2`}>
          {[["name", "Nom"], ["headline", "Poste"], ["company", "Entreprise"]].map(([k, label]) => <input key={k} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder={label} aria-label={label} className={field} data-testid={`lead-new-${k}`} />)}
          <textarea value={draft.commentText} onChange={(e) => setDraft({ ...draft, commentText: e.target.value })} rows={2} placeholder="Ce qu'elle a dit ou fait (facultatif)" className={field} data-testid="lead-new-comment" />
          <button type="button" onClick={add} className="text-sm font-medium px-4 py-2 rounded-lg bg-[#ff5a5f] text-white" data-testid="lead-new-save">Ajouter</button>
        </div>
      )}

      {data && leads.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5" aria-label="Filtrer par statut" data-testid="leads-filter-status">
            <option value="">Tous les statuts</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select value={filter.level} onChange={(e) => setFilter({ ...filter, level: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5" aria-label="Filtrer par niveau" data-testid="leads-filter-level">
            <option value="">Tous les niveaux</option>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            <option value="none">Pas encore notés</option>
          </select>
          <span className="text-gray-400 self-center" data-testid="leads-count">{shown.length} sur {leads.length}</span>
        </div>
      )}

      {data && !leads.length && (
        <div className={`${card} text-sm text-gray-500`} data-testid="leads-empty">
          Aucun lead pour l&apos;instant. {data.pageConnected ? "Dès qu'une personne commente votre page, elle apparaît ici (lecture toutes les 10 minutes)." : "Connectez votre page entreprise (écran Connexions) pour récupérer automatiquement les commentaires, ou ajoutez une personne à la main."}
        </div>
      )}
      {shown.map((l) => <LeadCard key={l.id} lead={l} onChange={change} onDelete={remove} />)}
    </main>
  );
}
