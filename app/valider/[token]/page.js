"use client";

import { useState, useEffect, use } from "react";
import { RefreshCw, AlertCircle, Check, Clock, MessageSquare } from "lucide-react";
import LpMark from "@/components/LpMark";

// Page ouverte par le client final depuis le lien de son agence : il relit ses posts, les valide ou demande des modifications.
// Aucun compte : le lien secret fait office d'accès.

const fmt = (d) => (d ? new Date(d).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null);

function PostCard({ post, token, onDone }) {
  const [mode, setMode] = useState(null); // null | "changes"
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const waiting = Boolean(post.clientFeedback); // une demande est déjà en attente chez l'agence

  const send = async (action) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approve/${token}/${post.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, comment }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erreur");
      onDone(post.id, action, comment.trim());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="bg-white rounded-xl border border-gray-200 p-5 space-y-3" data-testid="approval-post">
      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
        <span className="px-2 py-0.5 rounded-full bg-gray-100 font-medium">{post.onPage ? "Page entreprise" : "Profil"}</span>
        {post.scheduledAt && <span className="flex items-center gap-1"><Clock size={12} /> Publication prévue {fmt(post.scheduledAt)}</span>}
      </div>
      {post.imageUrl && <img src={post.imageUrl} alt="" className="rounded-lg w-full max-h-72 object-cover" />}
      <pre dir="auto" className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{post.text}</pre>

      {waiting ? (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 space-y-1">
          <p className="font-medium flex items-center gap-1.5"><MessageSquare size={14} /> Modification demandée — en attente de votre agence</p>
          <p className="text-xs">« {post.clientFeedback} »</p>
        </div>
      ) : mode === "changes" ? (
        <div className="space-y-2">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={1000} autoFocus placeholder="Qu'est-ce qui doit changer ? (ton, chiffre, formulation, image…)" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]" data-testid="approval-comment" />
          {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => send("changes")} disabled={busy || !comment.trim()} className="bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg" data-testid="approval-send-changes">Envoyer ma demande</button>
            <button type="button" onClick={() => { setMode(null); setError(null); }} disabled={busy} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {error && <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</p>}
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => send("approve")} disabled={busy} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5" data-testid="approval-approve">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Valider ce post
            </button>
            <button type="button" onClick={() => setMode("changes")} disabled={busy} className="border border-gray-300 hover:border-[#ff5a5f] hover:text-[#ff5a5f] text-gray-700 text-sm font-medium px-4 py-2 rounded-lg" data-testid="approval-changes">Demander une modification</button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ApprovePage({ params }) {
  const { token } = use(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState({ approved: 0, changes: 0 });

  useEffect(() => {
    fetch(`/api/approve/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Erreur");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  const onDone = (id, action, comment) => {
    if (action === "approve") {
      setDone((d) => ({ ...d, approved: d.approved + 1 }));
      setData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }));
    } else {
      setDone((d) => ({ ...d, changes: d.changes + 1 }));
      setData((d) => ({ ...d, posts: d.posts.map((p) => (p.id === id ? { ...p, clientFeedback: comment } : p)) }));
    }
  };

  const pending = data?.posts.filter((p) => !p.clientFeedback) ?? [];
  return (
    <div className="min-h-screen p-6">
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-[#ff5a5f] text-white p-2.5 rounded-xl"><LpMark size={24} /></div>
          <h1 className="font-bold text-xl">LinkeePost</h1>
        </div>

        {error ? (
          <p className="text-sm text-red-600 bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-2"><AlertCircle size={16} /> {error}</p>
        ) : !data ? (
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2 py-10"><RefreshCw size={16} className="animate-spin" /> Chargement…</p>
        ) : (
          <>
            <div>
              <h2 className="font-semibold text-lg">Posts LinkedIn de {data.client}</h2>
              <p className="text-sm text-gray-500">{data.agency ? `${data.agency} vous soumet ces publications. ` : ""}Validez chaque post : il partira à la date prévue. Vous pouvez aussi demander une modification.</p>
            </div>
            {(done.approved > 0 || done.changes > 0) && (
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3" data-testid="approval-summary">
                {done.approved > 0 && `${done.approved} post${done.approved > 1 ? "s validé" + "s" : " validé"}. `}{done.changes > 0 && `${done.changes} demande${done.changes > 1 ? "s" : ""} de modification envoyée${done.changes > 1 ? "s" : ""} à votre agence.`}
              </p>
            )}
            {data.posts.length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6 text-center">Aucun post à valider pour le moment. Gardez ce lien : les prochains posts apparaîtront ici.</p>
            ) : (
              <>
                {pending.length === 0 && <p className="text-xs text-gray-400">Tout est traité de votre côté : l&apos;agence a été prévenue.</p>}
                {data.posts.map((p) => <PostCard key={p.id} post={p} token={token} onDone={onDone} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
