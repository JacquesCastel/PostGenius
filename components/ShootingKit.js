"use client";

import { useState, useEffect, useRef } from "react";
import { Video, Play, Pause, X, Copy, Download, Clapperboard, Lightbulb, Monitor, FlipHorizontal } from "lucide-react";
import { getShots, spokenScript, kitToText } from "@/lib/shootingKit";

// Kit de tournage d'un post vidéo : plan plan par plan, prompteur plein écran,
// conseils. Fonctionne aussi pour les anciens scripts (items "0-5s — …").

function Teleprompter({ script, onClose }) {
  const boxRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40); // pixels par seconde
  const [size, setSize] = useState(40); // taille de police en px
  const [mirror, setMirror] = useState(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Défilement continu tant que "lecture" est actif ; s'arrête en bas du texte
  useEffect(() => {
    if (!playing) return;
    let raf;
    let last = performance.now();
    let pos = boxRef.current?.scrollTop ?? 0;
    const tick = (now) => {
      const el = boxRef.current;
      if (!el) return;
      pos += ((now - last) / 1000) * speedRef.current;
      last = now;
      el.scrollTop = pos;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const btn = "bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5";
  return (
    <div className="fixed inset-0 z-[60] bg-black text-white flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/10">
        <button onClick={() => setPlaying((p) => !p)} className={`${btn} !bg-[#ff5a5f] hover:!bg-[#f63d44]`}>
          {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Pause" : "Lecture"}
        </button>
        <label className="text-xs text-white/70 flex items-center gap-2">
          Vitesse
          <input type="range" min="10" max="150" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
        <label className="text-xs text-white/70 flex items-center gap-2">
          Taille
          <input type="range" min="24" max="80" value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        <button onClick={() => setMirror((m) => !m)} className={`${btn} ${mirror ? "!bg-white/30" : ""}`} title="Pour un prompteur à miroir">
          <FlipHorizontal size={13} /> Miroir
        </button>
        <button onClick={() => { boxRef.current && (boxRef.current.scrollTop = 0); setPlaying(false); }} className={btn}>
          Début
        </button>
        <button onClick={onClose} className={`${btn} ml-auto`}>
          <X size={13} /> Fermer
        </button>
      </div>
      <div ref={boxRef} className="flex-1 overflow-y-auto px-6 md:px-24" style={mirror ? { transform: "scaleX(-1)" } : undefined}>
        <div style={{ height: "35vh" }} />
        <p className="whitespace-pre-wrap leading-snug font-semibold text-center max-w-4xl mx-auto" style={{ fontSize: size }}>
          {script}
        </p>
        <div style={{ height: "60vh" }} />
      </div>
    </div>
  );
}

export default function ShootingKit({ text, extra, showToast }) {
  const [prompter, setPrompter] = useState(false);
  const shots = getShots(extra);
  const script = spokenScript(extra);
  const hasDetail = shots.some((s) => s.show || s.onScreen);

  if (!shots.length) return null;

  const copyKit = async () => {
    try {
      await navigator.clipboard.writeText(kitToText(text, extra));
      showToast?.("Plan de tournage copié ✓");
    } catch {
      showToast?.("Copie impossible");
    }
  };
  const downloadKit = () => {
    const blob = new Blob([kitToText(text, extra)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plan-de-tournage.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clapperboard size={16} className="text-[#ff5a5f]" /> Kit de tournage
          <span className="text-xs text-gray-400 font-normal">{shots.length} plans</span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setPrompter(true)}
            className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <Monitor size={12} /> Prompteur
          </button>
          <button onClick={copyKit} className="border border-gray-200 hover:border-gray-400 text-gray-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Copy size={12} /> Copier
          </button>
          <button onClick={downloadKit} className="border border-gray-200 hover:border-gray-400 text-gray-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Download size={12} /> .txt
          </button>
        </div>
      </div>

      <ol className="space-y-2">
        {shots.map((s, i) => (
          <li key={i} className="rounded-xl bg-gray-50 p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-[#ff5a5f]">Plan {i + 1}</span>
              {s.time && <span className="text-[11px] text-gray-400">{s.time}</span>}
            </div>
            <p className="text-gray-800">{s.say}</p>
            {s.show && (
              <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1.5">
                <Video size={12} className="mt-0.5 shrink-0" /> {s.show}
              </p>
            )}
            {s.onScreen && (
              <p className="text-xs text-sky-700 mt-1 bg-sky-50 inline-block rounded px-1.5 py-0.5">À l'écran : {s.onScreen}</p>
            )}
          </li>
        ))}
      </ol>
      {!hasDetail && (
        <p className="text-[11px] text-gray-400 mt-2">
          Script généré avant le kit de tournage : régénérez le post vidéo pour obtenir cadrage et texte à l'écran.
        </p>
      )}

      {extra?.tips?.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={13} className="text-amber-500" /> Conseils de tournage
          </p>
          <ul className="space-y-1">
            {extra.tips.map((t, i) => (
              <li key={i} className="text-xs text-gray-600">• {t}</li>
            ))}
          </ul>
        </div>
      )}

      {prompter && <Teleprompter script={script} onClose={() => setPrompter(false)} />}
    </div>
  );
}
