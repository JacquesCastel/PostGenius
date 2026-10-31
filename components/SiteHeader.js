"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound, LogOut, Menu, X } from "lucide-react";
import LpMark from "./LpMark";
import GoodbyeDialog from "./GoodbyeDialog";
import { JOIN_HREF, pick } from "@/lib/access";

// En-tête public partagé (landing, blog, contact, pages légales). Aussi rendu
// depuis app/app/page.js (client) sur l'écran de connexion/inscription — d'où
// le composant client avec vérification de session via /api/auth/me plutôt
// qu'une lecture de cookies côté serveur (incompatible avec cet usage-là).
const NAV = [
  ["/fonctionnalites", "Fonctionnalités"],
  ["/comment-ca-marche", "Comment ça marche"],
  ["/scoring", "Contrôle de forme"],
  ["/tarifs", "Tarifs"],
  ["/blog", "Blog"],
  ["/contact", "Contact"],
];

export default function SiteHeader() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [goodbye, setGoodbye] = useState(false); // fenêtre d'au revoir après la déconnexion
  const [open, setOpen] = useState(false); // menu sur téléphone et tablette

  // Session : au chargement, et au retour sur une page restaurée par le navigateur (bouton retour sur téléphone : la page revient de
  // la mémoire sans repasser par le serveur). Connecté sur la page d'accueil : on repart sur le tableau de bord.
  useEffect(() => {
    const check = () =>
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          setLoggedIn(Boolean(d.user));
          setUserName(d.user?.name ?? "");
          if (d.user && window.location.pathname === "/") window.location.replace("/app");
        })
        .catch(() => {});
    check();
    const onShow = (e) => { if (e.persisted) check(); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    setGoodbye(true);
  };

  if (goodbye) return <GoodbyeDialog name={userName} />;

  return (
    <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
      <div className="bg-white/80 backdrop-blur rounded-full shadow-lg shadow-rose-100/50 border border-white px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        <Link href={loggedIn ? "/app" : "/"} className="flex items-center gap-2 shrink-0" aria-label={loggedIn ? "LinkeePost : tableau de bord" : "LinkeePost : accueil"}>
          <div className="bg-[#ff5a5f] text-white p-1.5 rounded-xl shadow-md shadow-rose-300/40">
            <LpMark size={18} />
          </div>
          <span className="font-extrabold text-[#1b2a4a]">LinkeePost</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#5a6b85] mx-auto">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-[#ff5a5f] transition-colors">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Link
            href={loggedIn ? "/app" : JOIN_HREF}
            data-testid="site-cta"
            className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-semibold px-3.5 sm:px-5 py-2 rounded-full shadow-md shadow-rose-300/40 transition-colors whitespace-nowrap"
          >
            {loggedIn ? <><span className="sm:hidden">Mon espace</span><span className="hidden sm:inline">Tableau de bord</span></> : <><span className="sm:hidden">{pick("Bêta", "Essai")}</span><span className="hidden sm:inline">{pick("Rejoindre la bêta", "Essai gratuit")}</span></>}
          </Link>
          {loggedIn ? (
            <button
              onClick={logout}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="hidden sm:flex w-9 h-9 rounded-full border border-[#ffd5d6] items-center justify-center text-[#1b2a4a] hover:text-[#ff5a5f] hover:border-[#ff5a5f] transition-colors"
            >
              <LogOut size={17} />
            </button>
          ) : (
            <Link
              href="/app?mode=login"
              title="Se connecter"
              aria-label="Se connecter"
              data-testid="site-login"
              className="flex w-9 h-9 rounded-full border border-[#ffd5d6] items-center justify-center text-[#1b2a4a] hover:text-[#ff5a5f] hover:border-[#ff5a5f] transition-colors"
            >
              <UserRound size={17} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            data-testid="site-menu-toggle"
            className="lg:hidden w-9 h-9 rounded-full border border-[#ffd5d6] flex items-center justify-center text-[#1b2a4a] hover:text-[#ff5a5f] hover:border-[#ff5a5f] transition-colors"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden mt-2 bg-white rounded-3xl shadow-lg shadow-rose-100/50 border border-white p-2 flex flex-col" data-testid="site-menu">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="px-4 py-3 rounded-2xl text-[15px] font-medium text-[#1b2a4a] hover:bg-[#fff1f1]">{label}</Link>
          ))}
          {loggedIn && <Link href="/app" onClick={() => setOpen(false)} className="px-4 py-3 rounded-2xl text-[15px] font-semibold text-[#d63b42] hover:bg-[#fff1f1]">Tableau de bord</Link>}
          {loggedIn ? (
            <button type="button" onClick={logout} className="sm:hidden text-left px-4 py-3 rounded-2xl text-[15px] font-medium text-[#1b2a4a] hover:bg-[#fff1f1]">Se déconnecter</button>
          ) : (
            <Link href="/app?mode=login" onClick={() => setOpen(false)} className="sm:hidden px-4 py-3 rounded-2xl text-[15px] font-medium text-[#1b2a4a] hover:bg-[#fff1f1]">Se connecter</Link>
          )}
        </nav>
      )}
    </header>
  );
}
