"use client";

import { useEffect, useRef, useState } from "react";
import LpMark from "./LpMark";

// Fenêtre d'au revoir affichée juste après la déconnexion (application et pages publiques), puis retour à la page d'accueil du site.
// « Me reconnecter » sert à rattraper un clic involontaire. Échap ou « Retour au site » ferment sans attendre.
const SECONDS = 6;
const TIPS = [
  "La prochaine fois, dictez votre post à la voix : trois minutes suffisent, vous relisez ensuite.",
  "Un lien, un article, une note : ajoutez-les à votre datalake, vos prochains posts n'en seront que plus justes.",
  "Pour garder la régularité, programmez vos posts de la semaine d'un coup, en une séance de 30 minutes.",
];

export default function GoodbyeDialog({ name = "" }) {
  const [left, setLeft] = useState(SECONDS);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const btn = useRef(null);
  const first = String(name ?? "").trim().split(/\s+/)[0];
  const home = () => window.location.assign("/");

  useEffect(() => { btn.current?.focus(); }, []);
  useEffect(() => {
    if (left <= 0) { home(); return undefined; }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") home(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-b from-rose-50 via-orange-50/60 to-sky-50" data-testid="goodbye">
      <div role="dialog" aria-modal="true" aria-labelledby="goodbye-title" className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-rose-200/40 border border-white px-7 py-8 text-center text-[#1b2a4a]">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#ff5a5f] text-white flex items-center justify-center shadow-md shadow-rose-300/40"><LpMark size={28} /></div>
        <h2 id="goodbye-title" className="text-2xl font-extrabold mt-5" data-testid="goodbye-title">Au revoir{first ? `, ${first}` : ""} 👋</h2>
        <p className="text-[15px] text-[#5a6b85] mt-2 leading-relaxed">Merci d&apos;avoir pris ce temps pour votre présence sur LinkedIn.</p>
        <p className="text-[15px] font-semibold mt-4 leading-relaxed" data-testid="goodbye-scheduled">Ce que vous avez programmé partira à l&apos;heure prévue, même quand vous n&apos;êtes pas là.</p>
        <p className="text-sm text-[#5a6b85] bg-[#fff8f1] border border-[#fde1c0] rounded-2xl px-4 py-3 mt-4 leading-relaxed text-left" data-testid="goodbye-tip"><b className="text-[#a3242a]">Pour la prochaine fois.</b> {tip}</p>
        <div className="h-1.5 rounded-full bg-[#e8ecf2] mt-6 overflow-hidden" aria-hidden="true"><div className="h-1.5 rounded-full bg-[#ff5a5f] transition-[width] duration-1000 ease-linear" style={{ width: `${(left / SECONDS) * 100}%` }} /></div>
        <p className="text-xs text-[#5a6b85] mt-2" aria-live="polite" data-testid="goodbye-count">Retour au site dans {left} s</p>
        <div className="flex flex-col sm:flex-row gap-2.5 mt-5 justify-center">
          <button ref={btn} type="button" onClick={home} data-testid="goodbye-home" className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-bold px-6 py-3 rounded-full shadow-md shadow-rose-300/40">Retour au site</button>
          <button type="button" onClick={() => window.location.assign("/app?mode=login")} data-testid="goodbye-login" className="text-sm font-semibold text-[#5a6b85] hover:text-[#a3242a] px-4 py-3">Me reconnecter</button>
        </div>
      </div>
    </div>
  );
}
