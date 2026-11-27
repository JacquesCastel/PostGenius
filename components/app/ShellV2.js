"use client";
// Nouvelle application, tranche 1 : pièces du menu à cinq entrées (maquettes « Application »).
// Aucune fonction n'est retirée : chaque ancienne entrée devient un onglet de sa section ou un item du menu de la photo.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, ArrowUpCircle } from "lucide-react";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

// Pictos du menu : ceux des maquettes (tracés identiques), dans une pastille pastel
const ICON_PATHS = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  pen: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  doc: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  bar: <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />,
};
const ICON_TINTS = { sun: ["#FCE6D6", "#8A3B12"], pen: ["#F6E3E0", "#7A2342"], doc: ["#DCE9DF", "#2B5340"], bar: ["#FCE6D6", "#8A3B12"], users: ["#FCE6D6", "#8A3B12"], spark: ["#F6E3E0", "#7A2342"] };
export function NavIconV2({ name }) {
  const [bg, fg] = ICON_TINTS[name] ?? ICON_TINTS.sun;
  return (
    <span className="app-nav-ico" style={{ background: bg, color: fg }} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON_PATHS[name]}</svg>
    </span>
  );
}

// Indicateur des quatre étapes de la création d'un post : Idée, Relecture, Moment, Terminé
export function CreateStepsV2({ step, className = "" }) {
  const labels = ["Idée", "Relecture", "Moment", "Terminé"];
  return (
    <ol className={`app-steps ${className}`} aria-label="Étapes de la création d'un post" data-testid="create-steps">
      {labels.map((l, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "on" : "";
        return (
          <li key={l} className={`app-step ${state}`} aria-current={n === step ? "step" : undefined}>
            <i>{n < step ? "✓" : n}</i>{l}
          </li>
        );
      })}
    </ol>
  );
}

// « Le copilote a choisi pour vous » : thématique, humeur, où publier, chacun modifiable (« Changer » déplie le choix d'origine)
export function CreateChoicesV2({ rows, open, onToggle }) {
  const shown = rows.filter((r) => r.show);
  if (!shown.length) return null;
  return (
    <section className="app-card md:col-span-2 px-6 py-3" data-testid="create-choices" aria-label="Les choix du copilote">
      <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Le copilote a choisi pour vous <span className="normal-case tracking-normal font-normal">· changez ce qui ne convient pas</span></p>
      {shown.map((r, i) => (
        <div key={r.key} className={`flex flex-wrap items-center gap-3 py-3.5 ${i ? "border-t border-[#a88692]/20" : ""}`}>
          <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">{r.label}</span>
          <span className="flex-1 min-w-[12rem] text-[15px] font-semibold">{r.value}{r.hint ? <span className="font-normal text-gray-500"> · {r.hint}</span> : null}</span>
          <button type="button" onClick={() => onToggle(r.key)} aria-expanded={Boolean(open[r.key])} data-testid={`create-change-${r.key}`} className="text-sm font-semibold text-[#9E3157] hover:underline">{open[r.key] ? "Replier" : "Changer"}</button>
        </div>
      ))}
    </section>
  );
}

// Onglets de chaque section : [vue, libellé]. L'ordre est celui de la maquette.
export const SECTION_TABS = {
  write: [["create", "Un post"], ["campaigns", "Campagnes"], ["share", "À partir d'un lien"], ["events", "Événements"]],
  posts: [["history", "Mes posts"], ["engage", "Réponses à traiter"]],
  results: [["stats", "Statistiques"], ["leads", "Leads"]],
  space: [["profile", "Mon profil"], ["themes", "Thématiques"], ["datalake", "Sources"], ["connections", "Connexions"], ["brand-kit", "Charte graphique"], ["billing", "Abonnement"]],
};

export const sectionOfView = (view) => {
  for (const [section, tabs] of Object.entries(SECTION_TABS)) if (tabs.some(([v]) => v === view)) return section;
  return null;
};

// Rangée d'onglets au-dessus du contenu d'une vue (pas sur l'accueil de « Écrire », qui a ses quatre cartes)
export function SectionTabsV2({ view, onGo, isLocked }) {
  const section = sectionOfView(view);
  if (!section) return null;
  const tabs = SECTION_TABS[section];
  return (
    <div className="max-w-5xl mx-auto px-6 pt-3" data-testid="section-tabs">
      <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-2">
        {tabs.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => onGo(v)}
            data-testid={`tab-${v}`}
            className={`app-tab ${view === v ? "app-tab-on" : ""}`}
          >
            {label}
            {isLocked?.(v) ? <span aria-hidden="true"> 🔒</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// « Écrire » : quatre façons de commencer, qui mènent aux vues existantes
export function WriteHubV2({ onGo, isLocked }) {
  const cards = [
    { id: "create", title: "Un post", text: "Une idée, tapée ou dictée. Le copilote choisit la thématique et l'humeur, vous modifiez si besoin.", cta: "Écrire un post", main: true },
    { id: "campaigns", title: "Une campagne", text: "Une série de posts sur un thème, avec un plan que vous validez avant la rédaction." },
    { id: "share", title: "À partir d'un contenu", text: "Un lien, un document, une dictée, une vidéo ou un audio : on en tire des posts." },
    { id: "events", title: "Un événement", text: "Avant, pendant, après : les posts d'un salon ou d'une conférence, au jour J." },
  ];
  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6" data-testid="write-hub">
      <p className="text-base text-gray-600 max-w-xl">Quatre façons de démarrer. Elles mènent au même endroit : un texte à relire, avec ses sources.</p>
      <div className="grid sm:grid-cols-2 gap-6">
        {cards.map((c) => (
          <button key={c.id} type="button" onClick={() => onGo(c.id)} data-testid={`write-${c.id}`} className={`app-card text-left p-6 flex flex-col gap-2 ${c.main ? "app-card-main" : ""}`}>
            {c.main && <span className="self-start text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F6E3E0] text-[#7A2342]">Le plus courant</span>}
            {isLocked?.(c.id) && <span className="self-start text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FCE6D6] text-[#6E2E0E]">Offre supérieure</span>}
            <span className="font-display text-2xl">{c.title}</span>
            <span className="text-sm text-gray-600 leading-relaxed">{c.text}</span>
            <span className="mt-auto pt-2 text-sm font-semibold text-[#9E3157]">{c.cta ?? `${c.title} →`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Photo LinkedIn quand elle existe (et se charge), sinon l'initiale
function Avatar({ name, photoUrl }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="w-10 h-10 rounded-full object-cover shrink-0" data-testid="avatar-photo" />;
  }
  return (
    <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold shrink-0 bg-gradient-to-br from-[#C2456F] to-[#E8895F]">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// Logo Vercéa de la nouvelle application (même pastille que le site)
export function BrandV2() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="36" height="36" viewBox="0 0 40 40" role="img" aria-label="Vercéa"><circle cx="20" cy="20" r="20" fill="#F6E3E0" /><path d="M11 14 L20 28 L29 14" stroke="#C2456F" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="29" cy="12" r="2.6" fill="#2E1F33" /></svg>
      <span className="font-display text-2xl leading-none">Verc<span className="text-[#C2456F]">é</span>a</span>
    </span>
  );
}

// Photo / initiale en haut à droite : ouvre « Mon espace » (profil, thématiques, sources, connexions, charte, abonnement),
// l'offre et le compteur de posts du mois, l'administration pour les administrateurs, et la déconnexion.
export function AvatarMenuV2({ user, photoUrl, planName, planId, trialDays, postsThisMonth, postsLimit, postsReached, space, admin, onGo, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const name = user.name || "Mon compte";
  const sub = trialDays != null ? `${planName} · essai : ${trialDays} jour${trialDays > 1 ? "s" : ""}` : planName;
  const go = (id) => { setOpen(false); onGo(id); };
  return (
    <div className="relative" ref={ref} data-testid="avatar-menu">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mon espace"
        data-testid="avatar-button"
        className="app-avatar flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-full text-left"
      >
        <span className="hidden sm:block leading-tight text-right">
          <span className="block text-sm font-semibold truncate max-w-[10rem]">{name}</span>
          <span className="block text-xs text-gray-500">{sub}</span>
        </span>
        <Avatar name={name} photoUrl={photoUrl} />
        <ChevronDown size={16} className="text-gray-400 mr-1" />
      </button>
      {open && (
        <div role="menu" className="app-pop absolute right-0 mt-3 w-72 max-w-[88vw] z-40 p-3">
          <div className="px-3 pt-2 pb-3">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            {postsLimit != null && (
              <div className="mt-3" data-testid="avatar-quota">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-500">Posts ce mois</span>
                  <span className={`font-semibold ${postsReached ? "text-red-700" : "text-[#9E3157]"}`}>{postsThisMonth}/{postsLimit}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F6E3E0] overflow-hidden">
                  <div className={`h-full rounded-full ${postsReached ? "bg-red-600" : "bg-[#C2456F]"}`} style={{ width: `${Math.min(100, (postsThisMonth / postsLimit) * 100)}%` }} />
                </div>
                {postsReached && <p className="text-[11px] text-red-700 mt-1">Limite mensuelle atteinte.</p>}
              </div>
            )}
            {planId !== "agence" && (
              <a href="/tarifs" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#C2456F] hover:bg-[#9E3157] rounded-full py-1.5">
                <ArrowUpCircle size={14} /> Faire évoluer mon offre
              </a>
            )}
          </div>
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Mon espace</p>
          {space.map((it) => (
            <button key={it.id} role="menuitem" type="button" onClick={() => go(it.id)} data-testid={`space-${it.id}`} className="app-menuitem w-full text-left px-3 py-2 rounded-xl text-sm font-medium">
              {it.label}
            </button>
          ))}
          {admin.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Administration</p>
              {admin.map((it) => (
                <button key={it.id} role="menuitem" type="button" onClick={() => go(it.id)} data-testid={`space-${it.id}`} className="app-menuitem w-full text-left px-3 py-2 rounded-xl text-sm font-medium">
                  {it.label}
                </button>
              ))}
            </>
          )}
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onLogout(); }} data-testid="avatar-logout" className="app-menuitem mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-600">
            <LogOut size={15} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

// Entrées du menu de la photo (libellés complets)
export const SPACE_ITEMS = [
  { id: "profile", label: "Mon profil" },
  { id: "themes", label: "Mes thématiques" },
  { id: "datalake", label: "Mes sources (datalake éditorial)" },
  { id: "connections", label: "Connexions" },
  { id: "brand-kit", label: "Charte graphique" },
  { id: "billing", label: "Abonnement" },
];
export const ADMIN_ITEMS = [
  { id: "admin", label: "Administration" },
  { id: "content", label: "Contenu du site" },
  { id: "messages", label: "Messages" },
  { id: "tech", label: "Technique" },
];
