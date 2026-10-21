"use client";
import { useState, useEffect, useRef } from "react";
import { Mic, Square, X, RefreshCw } from "lucide-react";

// Dictée vocale : enregistre la voix dans le navigateur (3 minutes au plus), l'envoie à /api/transcribe et rend le texte.
// L'audio n'est jamais conservé (ni ici, ni sur le serveur). Le texte est toujours relu par l'utilisateur avant usage.

export const MAX_SECONDS = 180;
export const MIN_SECONDS = 5;
const NOTICE_KEY = "lp_voice_notice";
const MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]; // WebM : Chrome, Android ; MP4 : Safari, iPhone

export function canRecord() {
  return typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== "undefined";
}
const pickMime = () => MIMES.find((m) => window.MediaRecorder.isTypeSupported?.(m)) ?? "";
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const readJson = (res) => res.json().catch(() => ({}));

function micError(e) {
  if (e?.name === "NotAllowedError" || e?.name === "SecurityError") return "Le micro est bloqué. Autorisez-le dans le navigateur (icône de cadenas près de l'adresse), ou écrivez votre texte au clavier.";
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "Aucun micro détecté sur cet appareil. Écrivez votre texte au clavier.";
  return "Impossible d'ouvrir le micro. Écrivez votre texte au clavier.";
}

export default function VoiceRecorder({ language = "fr", onText }) {
  const [phase, setPhase] = useState("idle"); // idle | recording | sending
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState(null); // { usedSeconds, limitSeconds }
  const [notice, setNotice] = useState(false);
  const r = useRef({ rec: null, chunks: [], stream: null, ctx: null, raf: 0, timer: 0, start: 0, cancelled: false });

  const loadQuota = () => fetch("/api/transcribe").then(readJson).then((d) => (d.maxSeconds ? setQuota(d) : null)).catch(() => {});
  useEffect(() => { loadQuota(); return release; }, []);

  const release = () => {
    const s = r.current;
    clearInterval(s.timer); cancelAnimationFrame(s.raf);
    s.stream?.getTracks().forEach((t) => t.stop());
    try { s.ctx?.close(); } catch {}
    s.stream = null; s.ctx = null;
  };

  const remaining = quota?.limitSeconds == null ? null : Math.max(0, quota.limitSeconds - quota.usedSeconds);
  const exhausted = remaining !== null && remaining <= 0;

  const begin = async () => {
    setError(null); setNotice(false);
    const s = r.current;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(micError(e));
      return;
    }
    s.stream = stream; s.chunks = []; s.cancelled = false;
    const mime = pickMime();
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      release();
      setError("Cet appareil ne permet pas d'enregistrer la voix ici. Écrivez votre texte au clavier.");
      return;
    }
    s.rec = rec;
    rec.ondataavailable = (ev) => ev.data?.size && s.chunks.push(ev.data);
    rec.onstop = () => finish(rec.mimeType || mime || "audio/webm");
    // Niveau sonore : confirme à l'utilisateur que le micro l'entend
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => { an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) sum += ((v - 128) / 128) ** 2; setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4)); s.raf = requestAnimationFrame(tick); };
      s.ctx = ctx; tick();
    } catch {}
    s.start = Date.now(); setElapsed(0);
    s.timer = setInterval(() => {
      const t = (Date.now() - s.start) / 1000;
      setElapsed(t);
      if (t >= MAX_SECONDS) stop();
    }, 250);
    rec.start(1000);
    setPhase("recording");
  };

  const stop = () => { const s = r.current; if (s.rec && s.rec.state !== "inactive") s.rec.stop(); };
  const cancel = () => { r.current.cancelled = true; stop(); };

  const finish = async (mime) => {
    const s = r.current;
    const seconds = (Date.now() - s.start) / 1000;
    release(); setLevel(0);
    if (s.cancelled) { setPhase("idle"); setElapsed(0); return; }
    if (seconds < MIN_SECONDS) { setPhase("idle"); setElapsed(0); setError(`Trop court : parlez au moins ${MIN_SECONDS} secondes.`); return; }
    setPhase("sending");
    try {
      const body = new FormData();
      body.append("file", new Blob(s.chunks, { type: mime.split(";")[0] }), "dictee");
      body.append("seconds", String(Math.round(seconds)));
      body.append("language", language);
      const res = await fetch("/api/transcribe", { method: "POST", body });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error || "Transcription impossible.");
      loadQuota();
      onText(d.text, d.seconds);
    } catch (e) {
      setError(e.message);
      loadQuota();
    } finally {
      setPhase("idle"); setElapsed(0);
    }
  };

  const click = () => {
    let known = false;
    try { known = localStorage.getItem(NOTICE_KEY) === "1"; } catch {}
    if (known) begin(); else setNotice(true);
  };
  const accept = () => { try { localStorage.setItem(NOTICE_KEY, "1"); } catch {} begin(); };

  return (
    <div className="space-y-2 mb-3" data-testid="voice-recorder">
      {notice && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900" data-testid="voice-notice">
          <p className="font-semibold mb-1">Avant votre première dictée</p>
          <p>Votre voix est envoyée à notre prestataire d&apos;IA pour être transcrite, puis supprimée : aucun enregistrement n&apos;est conservé. Le texte vous appartient. N&apos;enregistrez pas d&apos;autres personnes sans leur accord.</p>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={accept} className="bg-[#ff5a5f] text-white text-xs font-semibold px-3 py-1.5 rounded-lg" data-testid="voice-notice-ok">J&apos;ai compris, enregistrer</button>
            <button type="button" onClick={() => setNotice(false)} className="text-gray-500 underline">Annuler</button>
          </div>
        </div>
      )}

      {phase === "idle" && !notice && (
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={click} disabled={exhausted} className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2" data-testid="voice-record">
            <Mic size={16} /> Enregistrer
          </button>
          <p className="text-[11px] text-gray-400">
            Parlez comme à un collègue, {MAX_SECONDS / 60} minutes au plus.
            {remaining !== null && <span data-testid="voice-quota"> {exhausted ? "Vos minutes du mois sont épuisées." : `Il vous reste ${Math.floor(remaining / 60)} min de dictée ce mois-ci.`}</span>}
          </p>
        </div>
      )}

      {phase === "recording" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center gap-3 flex-wrap" data-testid="voice-recording">
          <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" /></span>
          <span className="text-sm font-mono tabular-nums" data-testid="voice-timer" aria-live="off">{fmt(elapsed)}</span>
          <div className="flex-1 min-w-[60px] h-2 bg-red-100 rounded-full overflow-hidden" role="meter" aria-label="Niveau sonore" aria-valuenow={Math.round(level * 100)}><div className="h-full bg-red-500 transition-all" style={{ width: `${Math.round(level * 100)}%` }} /></div>
          <button type="button" onClick={stop} className="bg-[#1b2a4a] text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5" data-testid="voice-stop"><Square size={12} /> Terminer</button>
          <button type="button" onClick={cancel} className="text-gray-500 hover:text-gray-800 text-xs flex items-center gap-1" data-testid="voice-cancel"><X size={13} /> Annuler</button>
        </div>
      )}

      {phase === "sending" && (
        <p className="text-sm text-gray-600 flex items-center gap-2" data-testid="voice-sending"><RefreshCw size={14} className="animate-spin" /> Transcription en cours…</p>
      )}

      {error && <p className="text-xs text-red-600" data-testid="voice-error">{error}</p>}
    </div>
  );
}
