"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, X } from "lucide-react";

// Éléments de l'espace Agence : cloche de notifications d'équipe et planning multi-clients.

const readJson = async (r) => r.json().catch(() => ({}));

const ago = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.round(min / 60)} h`;
  return `il y a ${Math.round(min / 1440)} j`;
};

// ── Cloche : notifications de l'équipe (post à valider, décision du client, erreur, affectation, nouveau membre) ──
export function NotificationBell({ onOpenView, onOpenClient }) {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const load = () => fetch("/api/agency/notifications").then(readJson).then((d) => (d.items ? setData(d) : null)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const post = (body) => fetch("/api/agency/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  const readAll = async () => {
    await post({ all: true });
    setData((d) => ({ unread: 0, items: d.items.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) }));
  };
  const openItem = async (n) => {
    if (!n.readAt) {
      post({ id: n.id });
      setData((d) => ({ unread: Math.max(0, d.unread - 1), items: d.items.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)) }));
    }
    setOpen(false);
    // Commentaire sur la page d'un client : on ouvre directement « Interagir » dans l'espace de ce client
    if (n.view === "engage" && n.clientId && onOpenClient) onOpenClient(n.clientId, "engage", n.postUrl);
    else if (n.view === "engage" && n.postUrl && onOpenClient) onOpenClient(null, "engage", n.postUrl);
    else if (n.view) onOpenView?.(n.view);
  };

  return (
    <div className="relative" ref={box} data-testid="notif-bell">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${data.unread ? ` (${data.unread} non lues)` : ""}`} className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100">
        <Bell size={18} />
        {data.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ff5a5f] text-white text-[10px] font-bold flex items-center justify-center" data-testid="notif-count">{data.unread > 9 ? "9+" : data.unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-100 rounded-2xl shadow-xl z-40 overflow-hidden" data-testid="notif-panel">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <p className="font-semibold text-sm text-[#1b2a4a]">Notifications</p>
            {data.unread > 0 && <button type="button" onClick={readAll} className="text-xs text-[#ff5a5f] font-semibold" data-testid="notif-readall">Tout marquer comme lu</button>}
          </div>
          {data.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center px-4 py-8">Rien de nouveau pour l&apos;instant.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${n.readAt ? "" : "bg-[#fff8f8]"}`} data-testid="notif-item">
                    <div className="flex items-start gap-2">
                      {!n.readAt && <span className="w-2 h-2 rounded-full bg-[#ff5a5f] mt-1.5 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1b2a4a]">{n.title}</p>
                        {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">{ago(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Planning multi-clients ──
const STATUS_STYLE = {
  brouillon: "bg-gray-100 text-gray-600",
  "à valider": "bg-amber-100 text-amber-800",
  programmé: "bg-blue-100 text-blue-800",
  publié: "bg-green-100 text-green-800",
  erreur: "bg-red-100 text-red-700",
};
const STATUSES = ["brouillon", "à valider", "programmé", "publié", "erreur"];
const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalInput = (iso) => { const d = new Date(iso); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Les six semaines affichées pour un mois (la semaine commence le lundi)
function gridDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

export function AgencyPlanning({ showToast, onManage }) {
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [filters, setFilters] = useState({ clientId: "", memberId: "", status: "", type: "" });
  const [data, setData] = useState({ items: [], clients: [], members: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => gridDays(month), [month]);
  const load = () => {
    // marge d'un jour de chaque côté : les fuseaux horaires ne doivent pas faire disparaître un post en bord de grille
    const from = new Date(days[0]); from.setDate(from.getDate() - 1);
    const to = new Date(days[41]); to.setDate(to.getDate() + 1);
    const qs = new URLSearchParams({ from: ymd(from), to: ymd(to), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    setLoading(true);
    fetch(`/api/agency/planning?${qs}`).then(readJson).then((d) => (d.error ? showToast(d.error) : setData(d))).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [month, filters]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const it of data.items) {
      if (!it.at) continue;
      const key = ymd(new Date(it.at));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.at) - new Date(b.at));
    return map;
  }, [data.items]);

  const todayKey = ymd(new Date());
  const monthLabel = month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const sel = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700";

  const open = (it) => { setSelected(it); setWhen(it.at ? toLocalInput(it.at) : ""); };
  const reschedule = async () => {
    if (!when) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agency/posts/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledAt: new Date(when).toISOString() }) });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error || "Erreur");
      showToast("Post reprogrammé ✓");
      setSelected(null);
      load();
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden" data-testid="agency-planning">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Mois précédent" className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={16} /></button>
          <h3 className="font-semibold text-sm text-[#1b2a4a] capitalize w-36 text-center" data-testid="planning-month">{monthLabel}</h3>
          <button type="button" onClick={() => shift(1)} aria-label="Mois suivant" className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={16} /></button>
          <button type="button" onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }} className="ml-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">Aujourd&apos;hui</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <select value={filters.clientId} onChange={set("clientId")} aria-label="Filtrer par client" className={sel} data-testid="planning-filter-client">
            <option value="">Tous les clients</option>
            {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {data.members.length > 0 && (
            <select value={filters.memberId} onChange={set("memberId")} aria-label="Filtrer par équipier" className={sel} data-testid="planning-filter-member">
              <option value="">Toute l&apos;équipe</option>
              {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <select value={filters.status} onChange={set("status")} aria-label="Filtrer par statut" className={sel} data-testid="planning-filter-status">
            <option value="">Tous les statuts</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={filters.type} onChange={set("type")} aria-label="Filtrer par type" className={sel} data-testid="planning-filter-type">
            <option value="">Tous les types</option>
            <option value="simple">Post simple</option>
            <option value="carrousel">Carrousel</option>
            <option value="video">Vidéo</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {DAYS.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
          </div>
          <div className={`grid grid-cols-7 ${loading ? "opacity-60" : ""}`} data-testid="planning-grid">
            {days.map((d) => {
              const key = ymd(d);
              const list = byDay.get(key) ?? [];
              const inMonth = d.getMonth() === month.getMonth();
              return (
                <div key={key} className={`min-h-[96px] border-b border-r border-gray-50 p-1.5 ${inMonth ? "" : "bg-gray-50/60"}`} data-testid="planning-day" data-date={key}>
                  <p className={`text-[11px] mb-1 ${key === todayKey ? "inline-flex w-5 h-5 items-center justify-center rounded-full bg-[#ff5a5f] text-white font-bold" : inMonth ? "text-gray-500" : "text-gray-300"}`}>{d.getDate()}</p>
                  <div className="space-y-1">
                    {list.slice(0, 3).map((it) => (
                      <button key={it.id} type="button" onClick={() => open(it)} title={`${it.client.name} — ${it.text}`} className={`w-full text-left text-[11px] leading-tight rounded px-1.5 py-1 truncate ${STATUS_STYLE[it.status] ?? STATUS_STYLE.brouillon}`} data-testid="planning-post">
                        {new Date(it.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {it.client.name}
                      </button>
                    ))}
                    {list.length > 3 && <p className="text-[11px] text-gray-400 px-1">+ {list.length - 3} autre{list.length - 3 > 1 ? "s" : ""}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {STATUSES.filter((s) => s !== "brouillon").map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded ${STATUS_STYLE[s].split(" ")[0]}`} />{s[0].toUpperCase() + s.slice(1)}</span>
        ))}
        <span className="ml-auto">{data.items.length} post{data.items.length > 1 ? "s" : ""} sur la période affichée</span>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Post" data-testid="planning-dialog">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-[#1b2a4a]">{selected.client.name}</p>
                <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[selected.status] ?? STATUS_STYLE.brouillon}`}>{selected.status}</span>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fermer"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">{selected.text}</p>
            {selected.publishError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{selected.publishError}</p>}
            {selected.status !== "publié" ? (
              <label className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                Publication le
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" data-testid="planning-when" />
                <button type="button" onClick={reschedule} disabled={busy || !when} className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-semibold px-3 py-1.5 rounded-lg" data-testid="planning-reschedule">Reprogrammer</button>
              </label>
            ) : (
              <p className="text-xs text-gray-400">Publié le {new Date(selected.at).toLocaleString("fr-FR")}.</p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => onManage?.({ id: selected.client.id, name: selected.client.name }, "history")} className="border border-gray-200 text-gray-600 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50">Ouvrir l&apos;espace du client</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
