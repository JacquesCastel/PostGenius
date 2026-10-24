"use client";
import { useState } from "react";
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe2, Smartphone, Monitor } from "lucide-react";

// Prévisualisation d'un post dans une fenêtre de type LinkedIn : auteur, texte tronqué comme dans le fil (« …voir plus »),
// image, barre d'actions. Purement visuelle : le texte et l'image sont ceux qui seront publiés.
const LIMIT = { mobile: 210, desktop: 280 }; // caractères visibles avant « …voir plus » (environ 3 lignes)

function visibleText(text, limit) {
  if (text.length <= limit) return { shown: text, cut: false };
  const cut = text.slice(0, limit);
  const at = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  return { shown: (at > limit * 0.6 ? cut.slice(0, at) : cut).trimEnd(), cut: true };
}

export default function LinkedInPreview({ text = "", name = "Vous", headline = "", isPage = false, imageUrl = null, className = "" }) {
  const [device, setDevice] = useState("mobile");
  const [expanded, setExpanded] = useState(false);
  const clean = String(text ?? "");
  const { shown, cut } = visibleText(clean, LIMIT[device]);
  const initial = (name.trim()[0] || "V").toUpperCase();
  return (
    <div className={className} data-testid="li-preview">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Aperçu dans LinkedIn</p>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg" role="tablist" aria-label="Appareil">
          {[["mobile", "Mobile", Smartphone], ["desktop", "Ordinateur", Monitor]].map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={device === id} onClick={() => { setDevice(id); setExpanded(false); }} data-testid={`li-device-${id}`} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md ${device === id ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-[#f3f2ef] rounded-xl p-3 flex justify-center">
        <article className={`bg-white rounded-lg border border-[#e0dfdc] shadow-sm w-full ${device === "mobile" ? "max-w-[360px]" : "max-w-[540px]"} text-[#000000e6]`} style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
          <div className="flex items-start gap-2.5 px-3 pt-3">
            <span className={`w-12 h-12 shrink-0 flex items-center justify-center text-white font-semibold text-lg ${isPage ? "rounded bg-[#0a66c2]" : "rounded-full bg-gradient-to-br from-orange-400 to-[#ff5a5f]"}`} aria-hidden="true">{initial}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" data-testid="li-name">{name}</p>
              {headline && <p className="text-xs text-[#00000099] leading-snug line-clamp-2">{headline}</p>}
              <p className="text-xs text-[#00000099] flex items-center gap-1 mt-0.5">Maintenant · <Globe2 size={11} /></p>
            </div>
          </div>
          <div className="px-3 pt-2.5 pb-2 text-sm leading-[1.4] whitespace-pre-wrap break-words" dir="auto" data-testid="li-text">
            {expanded || !cut ? clean : shown}
            {cut && !expanded && (
              <>
                … <button type="button" onClick={() => setExpanded(true)} className="text-[#00000099] hover:text-[#0a66c2] hover:underline" data-testid="li-more">voir plus</button>
              </>
            )}
          </div>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full max-h-[360px] object-cover" data-testid="li-image" />
          )}
          <div className="flex flex-wrap items-center justify-around border-t border-[#e0dfdc] mx-3 mt-2 py-1 text-[#00000099] text-xs font-semibold">
            {[[ThumbsUp, "J'aime"], [MessageSquare, "Commenter"], [Repeat2, "Republier"], [Send, "Envoyer"]].map(([Icon, label]) => (
              <span key={label} className="flex items-center gap-1 py-2 px-0.5 text-[11px] sm:text-xs"><Icon size={16} className="shrink-0" />{label}</span>
            ))}
          </div>
        </article>
      </div>
      {cut && <p className="text-[11px] text-gray-400 mt-1.5">Dans le fil, LinkedIn n&apos;affiche que le début : soignez la première phrase. Cliquez sur « voir plus » pour lire la suite.</p>}
    </div>
  );
}
