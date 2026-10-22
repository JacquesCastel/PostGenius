"use client";
import { useState, useEffect, useRef } from "react";
import { Share2, ThumbsUp, PenLine, Database, Check, RefreshCw } from "lucide-react";
import ShareHowTo from "@/components/ShareHowTo";
import { cleanShare, shareKind, MIN_NOTE_CHARS, MIN_SOURCE_CHARS } from "@/lib/shareLink";

// Partager vers LinkeePost : un lien reçu du menu Partager du téléphone ou d'un favori du navigateur. L'outil ne peut pas lire un
// post LinkedIn : pour un post, on propose d'y répondre par son adresse, ou de coller son texte pour s'en inspirer ou le garder.
// Une page web publique, elle, est lue par le serveur. Rien n'est enregistré sans un clic.

const json = async (res) => res.json().catch(() => ({}));

export default function ShareView({ payload, activeContextId = null, showToast, onEngage, onWrite, onGoDatalake, onDone }) {
  const init = cleanShare(payload ?? {});
  const [url, setUrl] = useState(init.url);
  const [title, setTitle] = useState(init.title);
  const [text, setText] = useState(init.text);
  const [busy, setBusy] = useState(null); // "base" | "post"
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);
  const kind = shareKind(url.trim());
  const textLen = text.trim().length;
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const pasteNeeded = kind !== "web"; // post LinkedIn ou lien non lisible : le texte vient de l'utilisateur
  const canKeep = kind === "web" || textLen >= MIN_NOTE_CHARS;
  const canWrite = kind === "web" || textLen >= MIN_SOURCE_CHARS;

  const fail = async (res, fallback) => {
    const d = await json(res);
    throw new Error(d.error || fallback);
  };
  const keep = async () => {
    if (busy || !canKeep) return;
    setBusy("base");
    setError(null);
    try {
      const body = kind === "web"
        ? { kind: "link", url: url.trim(), title: title.trim() || undefined, contextId: activeContextId || undefined }
        : { kind: "note", title: title.trim() || (host ? `Post partagé (${host})` : "Texte partagé"), text: `${text.trim()}${url.trim() ? `\n\nSource : ${url.trim()}` : ""}`, contextId: activeContextId || undefined };
      const res = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) await fail(res, "Ajout impossible");
      setAdded(true);
      showToast("Ajouté à votre base de connaissances ✓");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const write = async () => {
    if (busy || !canWrite) return;
    setBusy("post");
    setError(null);
    try {
      let data;
      if (kind === "web") {
        const res = await fetch("/api/generate/source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
        if (!res.ok) await fail(res, "Lecture impossible");
        data = await json(res);
      } else {
        const full = text.trim();
        data = { kind: "text", title: title.trim() || (host ? `Post partagé (${host})` : "Texte partagé"), origin: host || "texte collé", text: full.slice(0, 12000), chars: full.length, truncated: full.length > 12000 };
      }
      onWrite(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-5";
  const btn = "text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-40";
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4" data-testid="share-view">
      <div className={card}>
        <p className="text-sm font-semibold flex items-center gap-2"><Share2 size={15} className="text-[#ff5a5f]" /> Partager vers LinkeePost</p>
        <p className="text-xs text-gray-400 mt-1">Un article, une page web ou un post LinkedIn : choisissez ce que vous voulez en faire. Rien n&apos;est enregistré sans votre clic.</p>
        <label className="block text-xs font-medium text-gray-500 mt-4 mb-1">Adresse</label>
        <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setAdded(false); }} placeholder="https://…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]" data-testid="share-url" />
        {url && (
          <p className="text-xs mt-1.5 text-gray-500" data-testid="share-kind">
            {kind === "linkedin-post" && "Post LinkedIn reconnu : LinkeePost ne peut pas lire son texte."}
            {kind === "linkedin" && "Lien LinkedIn (profil, page ou lien court) : LinkeePost ne peut pas le lire. Pour répondre à un post, ouvrez-le et copiez son adresse complète."}
            {kind === "web" && `Page web (${host}) : LinkeePost peut la lire.`}
            {kind === "none" && "Adresse non reconnue : collez une adresse commençant par https://"}
          </p>
        )}
        {(url || title) && (
          <>
            <label className="block text-xs font-medium text-gray-500 mt-3 mb-1">Titre <span className="text-gray-400">(facultatif)</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]" />
          </>
        )}
        {pasteNeeded && (
          <>
            <label className="block text-xs font-medium text-gray-500 mt-3 mb-1">Texte à utiliser <span className="text-gray-400">(collez le texte du post ou de l&apos;article)</span></label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={6000} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f] resize-y" data-testid="share-text" />
            <p className="text-[11px] text-gray-400 mt-1">{textLen} caractères : {MIN_NOTE_CHARS} au moins pour le garder dans votre base, {MIN_SOURCE_CHARS} pour écrire un post à partir de lui.</p>
          </>
        )}
      </div>

      <div className={card}>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Que voulez-vous en faire ?</p>
        <div className="space-y-3">
          {kind === "linkedin-post" && (
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-sm text-gray-700 max-w-md"><strong>Commenter ou réagir.</strong> Ouvre « Interagir » avec ce post déjà renseigné.</p>
              <button type="button" onClick={() => onEngage(url.trim())} className={`${btn} bg-[#0a66c2] hover:bg-[#084d92] text-white`} data-testid="share-engage"><ThumbsUp size={14} /> Commenter</button>
            </div>
          )}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-700 max-w-md"><strong>Écrire un post à partir de ça.</strong> {kind === "web" ? "LinkeePost lit la page puis rédige avec votre voix, sans rien inventer." : "LinkeePost s'inspire du texte collé pour rédiger avec votre voix : il reformule, il ne recopie pas."}</p>
            <button type="button" onClick={write} disabled={!canWrite || busy !== null} className={`${btn} bg-[#ff5a5f] hover:bg-[#f63d44] text-white`} data-testid="share-write">
              {busy === "post" ? <RefreshCw size={14} className="animate-spin" /> : <PenLine size={14} />} Écrire un post
            </button>
          </div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-700 max-w-md"><strong>Ajouter à mon datalake éditorial.</strong> {kind === "web" ? "La page est lue et analysée : faits, thèmes, vocabulaire." : "Le texte collé est analysé et gardé comme source."} Elle compte dans le quota de sources de votre offre.</p>
            {added ? (
              <button type="button" onClick={onGoDatalake} className={`${btn} border border-green-300 text-green-700`} data-testid="share-added"><Check size={14} /> Ajouté : voir la base</button>
            ) : (
              <button type="button" onClick={keep} disabled={!canKeep || busy !== null} className={`${btn} border border-gray-300 hover:border-[#ff5a5f] text-gray-700`} data-testid="share-keep">
                {busy === "base" ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />} Ajouter à mon datalake éditorial
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3" data-testid="share-error">{error}</p>}
        <p className="text-[11px] text-gray-400 mt-4 border-t border-gray-100 pt-3">Le texte d&apos;un autre auteur sert d&apos;inspiration : ne le recopiez pas tel quel, et citez-le si vous le reprenez.</p>
      </div>

      <div className={card} data-testid="share-howto">
        <p className="text-sm font-semibold mb-2">Partager plus vite</p>
        <ShareHowTo />
      </div>
      <button type="button" onClick={onDone} className="text-xs text-gray-400 hover:text-gray-600 underline">Fermer</button>
    </main>
  );
}
